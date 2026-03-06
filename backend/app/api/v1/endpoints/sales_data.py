from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from typing import List, Optional, Dict
from datetime import date, datetime
import pandas as pd
import io
import json
import re
import logging
import httpx
import xml.etree.ElementTree as ET

from app.database import get_db
from app.models.sales_data import SalesData
from app.models.user import User
from app.schemas.sales_data import (
    SalesDataCreate,
    SalesDataUpdate,
    SalesDataResponse,
    SalesDataAggregated,
    SalesDataBulkImport,
    SalesDataImportPreviewResponse,
    SalesDataImportResponse,
    TrackType,
)
from app.auth.dependencies import get_current_active_user, require_sales_or_higher
from app.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

# LLM model for mapping (smaller/faster model)
LLM_MAPPING_MODEL = "qwen2.5:3b"

# Field definitions for each track
COMMON_FIELDS = {
    'date': {
        'label': 'Дата', 'type': 'date', 'required': True,
        'aliases': ['дата', 'date', 'период', 'месяц', 'на дату', 'отчётная дата', 'отчетная дата']
    },
    'notes': {
        'label': 'Заметки', 'type': 'str', 'required': False,
        'aliases': ['заметки', 'notes', 'комментарий', 'примечание', 'comment']
    },
}

BANK_FIELDS = {
    **COMMON_FIELDS,
    'participants': {
        'label': 'Участники', 'type': 'int', 'required': False,
        'aliases': ['участники', 'participants', 'кол-во участников', 'число участников', 'количество участников']
    },
    'penetration': {
        'label': 'Проникновение (%)', 'type': 'float', 'required': False,
        'aliases': ['проникновение', 'penetration', '% проникновения', 'охват', 'проникновение %']
    },
    'employee_contributions': {
        'label': 'Взносы работников (млн)', 'type': 'float', 'required': False,
        'aliases': ['взносы работников', 'employee_contributions', 'взносы сотрудников', 'работники взносы']
    },
    'bank_contributions': {
        'label': 'Взносы Банка (млн)', 'type': 'float', 'required': False,
        'aliases': ['взносы банка', 'bank_contributions', 'софинансирование', 'банк взносы']
    },
}

EXTERNAL_FIELDS = {
    **COMMON_FIELDS,
    'enterprises': {
        'label': 'Предприятий', 'type': 'int', 'required': False,
        'aliases': ['предприятия', 'enterprises', 'кол-во предприятий', 'компании', 'количество предприятий']
    },
    'contracts': {
        'label': 'Договоры', 'type': 'int', 'required': False,
        'aliases': ['договоры', 'contracts', 'кол-во договоров', 'количество договоров']
    },
    'participants': {
        'label': 'Участники', 'type': 'int', 'required': False,
        'aliases': ['участники', 'participants', 'кол-во участников']
    },
    'collections': {
        'label': 'Взносы (млн)', 'type': 'float', 'required': False,
        'aliases': ['взносы', 'collections', 'сборы', 'сумма взносов', 'сборы млн']
    },
}

ZK_FIELDS = {
    **COMMON_FIELDS,
    'dds_count': {
        'label': 'Количество ДДС', 'type': 'int', 'required': False,
        'aliases': ['ддс', 'dds_count', 'кол-во ддс', 'количество ддс', 'пдс', 'количество пдс']
    },
    'dds_collections': {
        'label': 'Взносы ДДС (млн)', 'type': 'float', 'required': False,
        'aliases': ['взносы ддс', 'dds_collections', 'сумма ддс', 'сборы ддс', 'взносы пдс']
    },
}

TRACK_FIELDS = {
    'bank': BANK_FIELDS,
    'external': EXTERNAL_FIELDS,
    'zk': ZK_FIELDS
}

# Track detection keywords
TRACK_KEYWORDS = {
    'bank': ['кпп', 'банк', 'проникновение', 'софинансирование', 'взносы банка', 'взносы работников'],
    'external': ['внешние', 'предприятия', 'договоры', 'сборы', 'внешние продажи'],
    'zk': ['зк', 'ддс', 'пдс', 'зарплатные', 'зарплатный клиент']
}


def detect_track(columns: List[str], sample_data: List[Dict]) -> Optional[str]:
    """Detect track type based on column names and data."""
    columns_lower = [c.lower() for c in columns]
    all_text = ' '.join(columns_lower)

    # Also check sample data values
    for row in sample_data[:3]:
        for v in row.values():
            if v:
                all_text += ' ' + str(v).lower()

    scores = {'bank': 0, 'external': 0, 'zk': 0}

    for track, keywords in TRACK_KEYWORDS.items():
        for kw in keywords:
            if kw in all_text:
                scores[track] += 1

    max_score = max(scores.values())
    if max_score > 0:
        for track, score in scores.items():
            if score == max_score:
                return track

    return None


async def suggest_mapping_llm(
    excel_columns: List[str],
    sample_data: List[Dict],
    track: str
) -> Dict[str, Optional[str]]:
    """Use LLM to suggest field mapping based on column names and sample data."""
    fields = TRACK_FIELDS.get(track, COMMON_FIELDS)

    # Prepare field descriptions for prompt
    fields_desc = []
    for key, info in fields.items():
        fields_desc.append(f"- {key}: {info['label']}")
    fields_str = "\n".join(fields_desc)

    # Prepare sample data for prompt
    samples = []
    for col in excel_columns:
        col_samples = []
        for row in sample_data[:3]:
            val = row.get(col, '')
            if val:
                col_samples.append(str(val)[:50])
        samples.append(f'"{col}": [{", ".join(col_samples[:3])}]')
    samples_str = "\n".join(samples)

    prompt = f"""Ты помощник для импорта данных продаж. Сопоставь колонки из Excel-файла с полями системы.

Доступные поля системы (field_key: описание):
{fields_str}

Колонки файла с примерами данных:
{samples_str}

Верни ТОЛЬКО JSON-объект без markdown-разметки, где ключ - название колонки из файла, значение - field_key из списка выше или null если колонка не подходит ни к одному полю.

Пример ответа:
{{"Дата отчёта": "date", "Участники КПП": "participants", "ID": null}}

Твой ответ (только JSON):"""

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{settings.ollama_base_url}/api/generate",
                json={
                    "model": LLM_MAPPING_MODEL,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.1,
                        "num_predict": 500
                    }
                }
            )
            response.raise_for_status()
            llm_response = response.json()["response"].strip()

            # Parse JSON from response
            json_match = re.search(r'\{[^{}]*\}', llm_response, re.DOTALL)
            if json_match:
                llm_response = json_match.group()

            mapping = json.loads(llm_response)

            # Validate mapping
            valid_fields = set(fields.keys())
            result = {}
            used_fields = set()

            for col in excel_columns:
                field = mapping.get(col)
                if field and field in valid_fields and field not in used_fields:
                    result[col] = field
                    used_fields.add(field)
                else:
                    result[col] = None

            logger.info(f"LLM mapping result for {track}: {result}")
            return result

    except Exception as e:
        logger.error(f"LLM mapping failed: {e}")
        return suggest_mapping_simple(excel_columns, track)


def suggest_mapping_simple(excel_columns: List[str], track: str) -> Dict[str, Optional[str]]:
    """Fallback: simple string matching for field mapping."""
    fields = TRACK_FIELDS.get(track, COMMON_FIELDS)
    suggestions = {}
    used_fields = set()

    def clean_name(s: str) -> str:
        s = s.lower().strip()
        s = re.sub(r'[^\w\sа-яё]', ' ', s)
        s = re.sub(r'\s+', ' ', s).strip()
        return s

    for col in excel_columns:
        col_clean = clean_name(col)
        best_match = None
        best_score = 0.0

        for field_key, field_info in fields.items():
            if field_key in used_fields:
                continue

            for alias in field_info['aliases']:
                alias_clean = clean_name(alias)

                if col_clean == alias_clean:
                    best_match = field_key
                    best_score = 1.0
                    break

                if len(alias_clean) >= 3 and alias_clean in col_clean:
                    score = 0.9
                    if score > best_score:
                        best_match = field_key
                        best_score = score

            if best_score == 1.0:
                break

        if best_match and best_score > 0.5:
            suggestions[col] = best_match
            used_fields.add(best_match)
        else:
            suggestions[col] = None

    return suggestions


def parse_xml_to_dataframe(contents: bytes) -> tuple[pd.DataFrame, Optional[str]]:
    """Parse XML file to DataFrame and detect track."""
    try:
        root = ET.fromstring(contents.decode('utf-8'))
    except ET.ParseError as e:
        raise HTTPException(status_code=400, detail=f"Ошибка парсинга XML: {str(e)}")

    # Detect track from root element or attribute
    detected_track = None
    if root.tag == 'sales_data':
        detected_track = root.get('track')
    elif root.tag in ['bank', 'external', 'zk']:
        detected_track = root.tag

    # Find records
    records = []
    record_elements = root.findall('.//record')
    if not record_elements:
        # Try direct children as records
        record_elements = list(root)

    for record in record_elements:
        row = {}
        if record.tag == 'record':
            for child in record:
                row[child.tag] = child.text or ''
        else:
            # Each child element is a field
            for child in record:
                row[child.tag] = child.text or ''
            if not row:
                # Maybe the record itself has attributes
                row = dict(record.attrib)
        if row:
            records.append(row)

    if not records:
        raise HTTPException(status_code=400, detail="XML файл не содержит записей")

    df = pd.DataFrame(records)
    return df, detected_track


def generate_xml_export(data: List[Dict], track: str) -> str:
    """Generate XML from sales data."""
    root = ET.Element('sales_data')
    root.set('track', track)
    root.set('exported_at', datetime.now().isoformat())

    for item in data:
        record = ET.SubElement(root, 'record')
        for key, value in item.items():
            if value is not None:
                field = ET.SubElement(record, key)
                if isinstance(value, (date, datetime)):
                    field.text = value.isoformat() if hasattr(value, 'isoformat') else str(value)
                else:
                    field.text = str(value)

    # Pretty print
    ET.indent(root, space="  ")
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(root, encoding='unicode')


@router.get("/", response_model=List[SalesDataResponse])
async def list_sales_data(
    track: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    period_type: Optional[str] = None,
    limit: int = Query(default=100, le=500),
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Получить список данных продаж с фильтрацией."""
    query = select(SalesData)

    filters = []
    if track:
        filters.append(SalesData.track == track)
    if start_date:
        filters.append(SalesData.date >= start_date)
    if end_date:
        filters.append(SalesData.date <= end_date)
    if period_type:
        filters.append(SalesData.period_type == period_type)

    if filters:
        query = query.where(and_(*filters))

    query = query.order_by(SalesData.date.desc()).offset(offset).limit(limit)

    result = await db.execute(query)
    return result.scalars().all()


@router.get("/latest", response_model=dict)
async def get_latest_data(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Получить последние данные продаж по каждому треку."""
    result = {}

    for track in ["bank", "external", "zk"]:
        query_result = await db.execute(
            select(SalesData)
            .where(SalesData.track == track)
            .order_by(SalesData.date.desc())
            .limit(1)
        )
        data = query_result.scalar_one_or_none()
        if data:
            result[track] = SalesDataResponse.model_validate(data)

    return result


@router.get("/aggregated", response_model=List[SalesDataAggregated])
async def get_aggregated_data(
    track: Optional[str] = None,
    group_by: str = Query(default="month", enum=["week", "month", "quarter"]),
    year: int = 2026,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Получить агрегированные данные по периодам."""
    from sqlalchemy import extract, literal_column
    from app.database import DATABASE_URL

    is_postgres = DATABASE_URL.startswith("postgresql")

    if is_postgres:
        # PostgreSQL date functions
        if group_by == "month":
            period_expr = func.to_char(SalesData.date, 'YYYY-MM')
        elif group_by == "quarter":
            period_expr = func.concat(
                func.to_char(SalesData.date, 'YYYY'),
                '-Q',
                func.to_char(SalesData.date, 'Q')
            )
        else:  # week
            period_expr = func.to_char(SalesData.date, 'YYYY-"W"IW')

        year_filter = extract('year', SalesData.date) == year
    else:
        # SQLite date functions
        if group_by == "month":
            period_expr = func.strftime("%Y-%m", SalesData.date)
        elif group_by == "quarter":
            period_expr = func.strftime("%Y-Q", SalesData.date) + (
                (func.cast(func.strftime("%m", SalesData.date), type_=func.Integer) - 1) / 3 + 1
            ).cast(type_=func.String)
        else:  # week
            period_expr = func.strftime("%Y-W%W", SalesData.date)

        year_filter = func.strftime("%Y", SalesData.date) == str(year)

    filters = [year_filter]
    if track:
        filters.append(SalesData.track == track)

    result = await db.execute(
        select(
            period_expr.label("period"),
            SalesData.track,
            func.sum(SalesData.collections).label("collections"),
            func.sum(SalesData.participants).label("participants"),
            func.avg(SalesData.penetration).label("penetration"),
            func.max(SalesData.enterprises).label("enterprises"),
            func.sum(SalesData.contracts).label("contracts"),
        )
        .where(and_(*filters))
        .group_by(period_expr, SalesData.track)
        .order_by(period_expr)
    )

    rows = result.all()
    return [
        SalesDataAggregated(
            period=row.period or "",
            track=row.track or "bank",
            collections=row.collections or 0,
            participants=row.participants or 0,
            penetration=round(row.penetration or 0, 2),
            enterprises=row.enterprises or 0,
            contracts=row.contracts or 0,
        )
        for row in rows
    ]


@router.get("/{sales_id}", response_model=SalesDataResponse)
async def get_sales_data(
    sales_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Получить данные продаж по ID."""
    result = await db.execute(
        select(SalesData).where(SalesData.id == sales_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Sales data not found")
    return item


@router.post("/", response_model=SalesDataResponse)
async def create_sales_data(
    data: SalesDataCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_sales_or_higher)
):
    """Создать новую запись данных продаж."""
    item = SalesData(**data.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.post("/bulk", response_model=List[SalesDataResponse])
async def bulk_import_sales_data(
    bulk_data: SalesDataBulkImport,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_sales_or_higher)
):
    """Массовый импорт данных продаж."""
    items = []
    for data in bulk_data.data:
        item = SalesData(**data.model_dump())
        db.add(item)
        items.append(item)

    await db.commit()

    for item in items:
        await db.refresh(item)

    return items


@router.put("/{sales_id}", response_model=SalesDataResponse)
async def update_sales_data(
    sales_id: int,
    data: SalesDataUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_sales_or_higher)
):
    """Обновить данные продаж."""
    result = await db.execute(
        select(SalesData).where(SalesData.id == sales_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Sales data not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)

    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/{sales_id}")
async def delete_sales_data(
    sales_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_sales_or_higher)
):
    """Удалить данные продаж."""
    result = await db.execute(
        select(SalesData).where(SalesData.id == sales_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Sales data not found")

    await db.delete(item)
    await db.commit()
    return {"message": "Sales data deleted"}


@router.get("/export/xml")
async def export_sales_data_xml(
    track: str = Query(..., enum=['bank', 'external', 'zk']),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Экспорт данных продаж в XML формате."""
    result = await db.execute(
        select(SalesData)
        .where(SalesData.track == track)
        .order_by(SalesData.date.desc())
    )
    items = result.scalars().all()

    if not items:
        # Return empty sample template
        fields = TRACK_FIELDS.get(track, COMMON_FIELDS)
        sample_record = {'date': date.today().isoformat()}
        for key in fields.keys():
            if key != 'date':
                sample_record[key] = ''

        xml_content = generate_xml_export([sample_record], track)
    else:
        # Export actual data
        data = []
        for item in items:
            row = {
                'date': item.date,
                'notes': item.notes or '',
            }
            if track == 'bank':
                row.update({
                    'participants': item.participants or 0,
                    'penetration': item.penetration or 0,
                    'employee_contributions': item.employee_contributions or 0,
                    'bank_contributions': item.bank_contributions or 0,
                })
            elif track == 'external':
                row.update({
                    'enterprises': item.enterprises or 0,
                    'contracts': item.contracts or 0,
                    'participants': item.participants or 0,
                    'collections': item.collections or 0,
                })
            elif track == 'zk':
                row.update({
                    'dds_count': item.dds_count or 0,
                    'dds_collections': item.dds_collections or 0,
                })
            data.append(row)

        xml_content = generate_xml_export(data, track)

    return Response(
        content=xml_content,
        media_type="application/xml",
        headers={
            "Content-Disposition": f"attachment; filename=sales_data_{track}.xml"
        }
    )


@router.get("/export/sample-xml")
async def get_sample_xml(
    track: str = Query(..., enum=['bank', 'external', 'zk']),
    current_user: User = Depends(get_current_active_user)
):
    """Получить образец XML-файла для импорта."""
    fields = TRACK_FIELDS.get(track, COMMON_FIELDS)

    # Create sample records with example data
    sample_data = []
    today = date.today()

    for i in range(3):
        sample_date = date(today.year, today.month - i if today.month > i else 12 - i, 1)
        row = {'date': sample_date.isoformat()}

        if track == 'bank':
            row.update({
                'participants': 1000 + i * 100,
                'penetration': 45.5 + i * 2,
                'employee_contributions': 5.2 + i * 0.5,
                'bank_contributions': 2.6 + i * 0.3,
                'notes': f'Данные за {sample_date.strftime("%B %Y")}'
            })
        elif track == 'external':
            row.update({
                'enterprises': 25 + i * 5,
                'contracts': 30 + i * 8,
                'participants': 2500 + i * 300,
                'collections': 12.5 + i * 1.5,
                'notes': f'Отчёт за {sample_date.strftime("%B %Y")}'
            })
        elif track == 'zk':
            row.update({
                'dds_count': 500 + i * 50,
                'dds_collections': 8.3 + i * 0.8,
                'notes': f'Продажи ЗК за {sample_date.strftime("%B %Y")}'
            })

        sample_data.append(row)

    xml_content = generate_xml_export(sample_data, track)

    return Response(
        content=xml_content,
        media_type="application/xml",
        headers={
            "Content-Disposition": f"attachment; filename=sample_{track}.xml"
        }
    )


@router.post("/import/preview", response_model=SalesDataImportPreviewResponse)
async def preview_sales_import(
    file: UploadFile = File(...),
    track: Optional[str] = Query(None, enum=['bank', 'external', 'zk']),
    current_user: User = Depends(require_sales_or_higher)
):
    """Предпросмотр файла и рекомендация маппинга колонок."""
    allowed_extensions = ('.xlsx', '.xls', '.csv', '.xml')
    if not file.filename.endswith(allowed_extensions):
        raise HTTPException(status_code=400, detail="Файл должен быть Excel, CSV или XML")

    contents = await file.read()
    xml_detected_track = None

    try:
        if file.filename.endswith('.xml'):
            df, xml_detected_track = parse_xml_to_dataframe(contents)
        elif file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(contents))
        else:
            df = pd.read_excel(io.BytesIO(contents))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Не удалось прочитать файл: {str(e)}")

    # Get columns and sample data
    columns = df.columns.tolist()
    sample_data = df.head(5).fillna('').to_dict('records')

    # Detect track if not specified (prefer XML attribute, then parameter, then auto-detect)
    detected_track = track or xml_detected_track or detect_track(columns, sample_data)
    if not detected_track:
        detected_track = 'bank'  # Default to bank

    # Suggest mapping using LLM
    try:
        suggested_mapping = await suggest_mapping_llm(columns, sample_data, detected_track)
        mapping_method = 'llm'
    except Exception as e:
        logger.warning(f"LLM mapping failed, using fallback: {e}")
        suggested_mapping = suggest_mapping_simple(columns, detected_track)
        mapping_method = 'fallback'

    # Available fields for mapping
    fields = TRACK_FIELDS.get(detected_track, COMMON_FIELDS)
    available_fields = {
        key: {'label': info['label'], 'required': info.get('required', False)}
        for key, info in fields.items()
    }

    return SalesDataImportPreviewResponse(
        columns=columns,
        sample_data=sample_data,
        suggested_mapping=suggested_mapping,
        available_fields=available_fields,
        total_rows=len(df),
        mapping_method=mapping_method,
        detected_track=detected_track
    )


@router.post("/import", response_model=SalesDataImportResponse)
async def import_sales_data(
    file: UploadFile = File(...),
    mapping: str = Form(...),
    track: str = Form(...),
    duplicate_handling: str = Form(default='skip'),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_sales_or_higher)
):
    """Импорт данных продаж с кастомным маппингом."""
    allowed_extensions = ('.xlsx', '.xls', '.csv', '.xml')
    if not file.filename.endswith(allowed_extensions):
        raise HTTPException(status_code=400, detail="Файл должен быть Excel, CSV или XML")

    if track not in ['bank', 'external', 'zk']:
        raise HTTPException(status_code=400, detail="Некорректный трек")

    # Parse mapping JSON
    try:
        column_mapping = json.loads(mapping)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Некорректный формат маппинга")

    contents = await file.read()

    try:
        if file.filename.endswith('.xml'):
            df, _ = parse_xml_to_dataframe(contents)
        elif file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(contents))
        else:
            df = pd.read_excel(io.BytesIO(contents))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Не удалось прочитать файл: {str(e)}")

    # Validate that 'date' field is mapped
    date_mapped = any(v == 'date' for v in column_mapping.values() if v)
    if not date_mapped:
        raise HTTPException(status_code=400, detail="Поле 'Дата' обязательно для импорта")

    fields = TRACK_FIELDS.get(track, COMMON_FIELDS)
    imported = 0
    skipped = 0
    updated = 0
    errors = []

    for idx, row in df.iterrows():
        try:
            sales_data = {'track': track, 'period_type': 'monthly'}

            for excel_col, field_key in column_mapping.items():
                if not field_key or excel_col not in df.columns:
                    continue

                value = row.get(excel_col)
                if pd.isna(value):
                    continue

                field_info = fields.get(field_key, {})
                field_type = field_info.get('type', 'str')

                # Type conversion
                if field_type == 'int':
                    try:
                        value = int(float(value))
                    except (ValueError, TypeError):
                        value = 0
                elif field_type == 'float':
                    try:
                        value = float(value)
                    except (ValueError, TypeError):
                        value = 0.0
                elif field_type == 'date':
                    try:
                        if isinstance(value, str):
                            # Try various date formats
                            for fmt in ['%Y-%m-%d', '%d.%m.%Y', '%d/%m/%Y', '%Y/%m/%d']:
                                try:
                                    value = datetime.strptime(value, fmt).date()
                                    break
                                except ValueError:
                                    continue
                        elif hasattr(value, 'date'):
                            value = value.date()
                        elif hasattr(value, 'to_pydatetime'):
                            value = value.to_pydatetime().date()
                    except Exception:
                        value = None
                else:
                    value = str(value).strip()

                if value is not None:
                    sales_data[field_key] = value

            # Skip rows without date
            if 'date' not in sales_data or not sales_data['date']:
                continue

            # Check for duplicates
            existing = await db.execute(
                select(SalesData).where(
                    and_(
                        SalesData.track == track,
                        SalesData.date == sales_data['date']
                    )
                )
            )
            existing_item = existing.scalar_one_or_none()

            if existing_item:
                if duplicate_handling == 'skip':
                    skipped += 1
                    continue
                elif duplicate_handling == 'update':
                    for key, value in sales_data.items():
                        if key not in ['track', 'date']:
                            setattr(existing_item, key, value)
                    updated += 1
                else:  # append - create new record anyway
                    item = SalesData(**sales_data)
                    db.add(item)
                    imported += 1
            else:
                item = SalesData(**sales_data)
                db.add(item)
                imported += 1

        except Exception as e:
            errors.append(f"Строка {idx + 2}: {str(e)}")

    await db.commit()

    return SalesDataImportResponse(
        message=f"Импортировано {imported} записей",
        imported=imported,
        skipped=skipped,
        updated=updated,
        errors=errors[:10] if errors else None,
        track=track
    )


