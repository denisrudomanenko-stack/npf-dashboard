from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Dict, Optional
import pandas as pd
import io
import json
import re
import logging
import httpx

from app.database import get_db
from app.models.enterprise import Enterprise, EnterpriseStatus, EnterpriseCategory, SalesStatus
from app.models.interaction import Interaction
from app.models.user import User
from app.schemas.enterprise import EnterpriseCreate, EnterpriseUpdate, EnterpriseResponse, InteractionCreate, InteractionResponse
from app.config import settings
from app.auth.dependencies import get_current_active_user, require_manager

router = APIRouter()
logger = logging.getLogger(__name__)

# LLM model for mapping (smaller/faster model)
LLM_MAPPING_MODEL = "qwen2.5:3b"

# Field definitions for mapping with extended aliases
ENTERPRISE_FIELDS = {
    'name': {
        'label': 'Наименование', 'type': 'str', 'required': True,
        'aliases': ['название', 'наименование', 'name', 'company', 'компания', 'предприятие',
                    'организация', 'клиент', 'client', 'юрлицо', 'юр. лицо', 'фирма', 'название компании',
                    'наименование организации', 'наименование предприятия', 'название предприятия']
    },
    'inn': {
        'label': 'ИНН', 'type': 'str', 'required': False,
        'aliases': ['инн', 'inn', 'tax_id', 'налоговый номер', 'инн/кпп', 'инн организации',
                    'tax id', 'taxpayer', 'идентификационный номер']
    },
    'holding': {
        'label': 'Холдинг', 'type': 'str', 'required': False,
        'aliases': ['холдинг', 'holding', 'группа', 'группа компаний', 'group', 'головная компания',
                    'материнская компания', 'parent', 'parent company', 'гк', 'корпорация']
    },
    'industry': {
        'label': 'Отрасль', 'type': 'str', 'required': False,
        'aliases': ['отрасль', 'industry', 'сфера', 'sector', 'сектор', 'вид деятельности',
                    'направление', 'сфера деятельности', 'оквэд', 'segment']
    },
    'employee_count': {
        'label': 'Численность', 'type': 'int', 'required': False,
        'aliases': ['численность', 'сотрудники', 'employees', 'employee_count', 'штат',
                    'кол-во сотрудников', 'количество сотрудников', 'персонал', 'headcount',
                    'число сотрудников', 'численность персонала', 'чел', 'человек']
    },
    'bank_penetration': {
        'label': 'Проникновение ЗП', 'type': 'float', 'required': False,
        'aliases': ['проникновение', 'penetration', 'зп проект', 'зарплатный проект',
                    'проникновение зп', 'доля зп', '% зп', 'процент зп', 'зарплатный']
    },
    'category': {
        'label': 'Категория', 'type': 'category', 'required': False,
        'aliases': ['категория', 'category', 'приоритет', 'priority', 'тип', 'type',
                    'класс', 'class', 'сегмент', 'грейд', 'grade']
    },
    'score': {
        'label': 'Скоринг-балл', 'type': 'int', 'required': False,
        'aliases': ['балл', 'score', 'скоринг', 'рейтинг', 'rating', 'оценка',
                    'scoring', 'баллы', 'очки', 'points']
    },
    'locations': {
        'label': 'Площадки', 'type': 'str', 'required': False,
        'aliases': ['площадки', 'locations', 'филиалы', 'регионы', 'адрес', 'address',
                    'город', 'города', 'регион', 'локации', 'офисы', 'offices', 'местоположение']
    },
    'contact_person': {
        'label': 'Контактное лицо', 'type': 'str', 'required': False,
        'aliases': ['контакт', 'contact', 'контактное лицо', 'фио', 'представитель',
                    'contact person', 'лпр', 'контактное лицо клиента', 'имя контакта',
                    'ответственное лицо', 'директор', 'руководитель']
    },
    'contact_email': {
        'label': 'Email', 'type': 'str', 'required': False,
        'aliases': ['email', 'почта', 'e-mail', 'электронная почта', 'mail', 'эл. почта',
                    'емейл', 'емэйл', 'адрес электронной почты', 'e mail']
    },
    'contact_phone': {
        'label': 'Телефон', 'type': 'str', 'required': False,
        'aliases': ['телефон', 'phone', 'тел', 'мобильный', 'tel', 'telephone',
                    'номер телефона', 'моб', 'сотовый', 'mobile', 'контактный телефон']
    },
    'manager': {
        'label': 'Менеджер', 'type': 'str', 'required': False,
        'aliases': ['менеджер', 'manager', 'ответственный', 'куратор', 'account manager',
                    'ответственный менеджер', 'сопровождающий', 'клиентский менеджер', 'км']
    },
    'notes': {
        'label': 'Заметки', 'type': 'str', 'required': False,
        'aliases': ['заметки', 'notes', 'комментарий', 'примечание', 'comment', 'comments',
                    'описание', 'description', 'прим', 'примечания', 'коммент', 'remarks']
    },
}


async def suggest_mapping_llm(
    excel_columns: List[str],
    sample_data: List[Dict]
) -> Dict[str, Optional[str]]:
    """Use LLM to suggest field mapping based on column names and sample data"""

    # Prepare field descriptions for prompt
    fields_desc = []
    for key, info in ENTERPRISE_FIELDS.items():
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

    prompt = f"""Ты помощник для импорта данных. Сопоставь колонки из Excel-файла с полями карточки клиента.

Доступные поля системы (field_key: описание):
{fields_str}

Колонки файла с примерами данных:
{samples_str}

Верни ТОЛЬКО JSON-объект без markdown-разметки, где ключ - название колонки из файла, значение - field_key из списка выше или null если колонка не подходит ни к одному полю.

Пример ответа:
{{"Название компании": "name", "ИНН организации": "inn", "Примечание": "notes", "ID": null}}

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
            # Try to extract JSON if wrapped in markdown
            json_match = re.search(r'\{[^{}]*\}', llm_response, re.DOTALL)
            if json_match:
                llm_response = json_match.group()

            mapping = json.loads(llm_response)

            # Validate mapping - ensure values are valid field keys or null
            valid_fields = set(ENTERPRISE_FIELDS.keys())
            result = {}
            used_fields = set()

            for col in excel_columns:
                field = mapping.get(col)
                if field and field in valid_fields and field not in used_fields:
                    result[col] = field
                    used_fields.add(field)
                else:
                    result[col] = None

            logger.info(f"LLM mapping result: {result}")
            return result

    except Exception as e:
        logger.error(f"LLM mapping failed: {e}")
        # Fallback to simple mapping
        return suggest_mapping_simple(excel_columns)


def suggest_mapping_simple(excel_columns: List[str]) -> Dict[str, Optional[str]]:
    """Fallback: simple string matching for field mapping"""
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

        for field_key, field_info in ENTERPRISE_FIELDS.items():
            if field_key in used_fields:
                continue

            for alias in field_info['aliases']:
                alias_clean = clean_name(alias)

                if col_clean == alias_clean:
                    best_match = field_key
                    best_score = 1.0
                    break

                if len(alias_clean) >= 3:
                    if alias_clean in col_clean:
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


@router.get("/", response_model=List[EnterpriseResponse])
async def get_enterprises(
    skip: int = 0,
    limit: int = 100,
    status: EnterpriseStatus = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = select(Enterprise).options(selectinload(Enterprise.interactions))
    if status:
        query = query.where(Enterprise.status == status)
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{enterprise_id}", response_model=EnterpriseResponse)
async def get_enterprise(
    enterprise_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(
        select(Enterprise)
        .options(selectinload(Enterprise.interactions))
        .where(Enterprise.id == enterprise_id)
    )
    enterprise = result.scalar_one_or_none()
    if not enterprise:
        raise HTTPException(status_code=404, detail="Enterprise not found")
    return enterprise


@router.post("/", response_model=EnterpriseResponse)
async def create_enterprise(
    enterprise: EnterpriseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    db_enterprise = Enterprise(**enterprise.model_dump())
    db.add(db_enterprise)
    await db.commit()
    await db.refresh(db_enterprise)
    return db_enterprise


@router.put("/{enterprise_id}", response_model=EnterpriseResponse)
async def update_enterprise(
    enterprise_id: int,
    enterprise: EnterpriseUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    result = await db.execute(select(Enterprise).where(Enterprise.id == enterprise_id))
    db_enterprise = result.scalar_one_or_none()
    if not db_enterprise:
        raise HTTPException(status_code=404, detail="Enterprise not found")

    for key, value in enterprise.model_dump(exclude_unset=True).items():
        setattr(db_enterprise, key, value)

    await db.commit()
    await db.refresh(db_enterprise)
    return db_enterprise


@router.delete("/{enterprise_id}")
async def delete_enterprise(
    enterprise_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    result = await db.execute(select(Enterprise).where(Enterprise.id == enterprise_id))
    enterprise = result.scalar_one_or_none()
    if not enterprise:
        raise HTTPException(status_code=404, detail="Enterprise not found")

    await db.delete(enterprise)
    await db.commit()
    return {"message": "Enterprise deleted"}


@router.post("/import/preview")
async def preview_import(
    file: UploadFile = File(...),
    current_user: User = Depends(require_manager)
):
    """Preview Excel/CSV file and suggest column mapping"""
    if not file.filename.endswith(('.xlsx', '.xls', '.csv')):
        raise HTTPException(status_code=400, detail="File must be Excel or CSV")

    contents = await file.read()

    try:
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(contents))
        else:
            df = pd.read_excel(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {str(e)}")

    # Get columns and sample data
    columns = df.columns.tolist()
    sample_data = df.head(5).fillna('').to_dict('records')

    # Suggest mapping using LLM
    try:
        suggested_mapping = await suggest_mapping_llm(columns, sample_data)
        mapping_method = 'llm'
    except Exception as e:
        logger.warning(f"LLM mapping failed, using fallback: {e}")
        suggested_mapping = suggest_mapping_simple(columns)
        mapping_method = 'fallback'

    # Available fields for mapping
    available_fields = {
        key: {'label': info['label'], 'required': info['required']}
        for key, info in ENTERPRISE_FIELDS.items()
    }

    return {
        'columns': columns,
        'sample_data': sample_data,
        'suggested_mapping': suggested_mapping,
        'available_fields': available_fields,
        'total_rows': len(df),
        'mapping_method': mapping_method
    }


@router.post("/import")
async def import_enterprises(
    file: UploadFile = File(...),
    mapping: str = Form(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    """Import enterprises from Excel/CSV file with custom column mapping"""
    if not file.filename.endswith(('.xlsx', '.xls', '.csv')):
        raise HTTPException(status_code=400, detail="File must be Excel or CSV")

    # Parse mapping JSON
    try:
        column_mapping = json.loads(mapping)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid mapping format")

    contents = await file.read()

    try:
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(contents))
        else:
            df = pd.read_excel(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {str(e)}")

    # Validate that 'name' field is mapped
    name_mapped = any(v == 'name' for v in column_mapping.values() if v)
    if not name_mapped:
        raise HTTPException(status_code=400, detail="Поле 'Наименование' обязательно для импорта")

    imported = 0
    errors = []

    for idx, row in df.iterrows():
        try:
            enterprise_data = {}

            for excel_col, field_key in column_mapping.items():
                if not field_key or excel_col not in df.columns:
                    continue

                value = row.get(excel_col)
                if pd.isna(value):
                    continue

                field_info = ENTERPRISE_FIELDS.get(field_key, {})
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
                elif field_type == 'category':
                    value = str(value).upper().strip()
                    if value not in ['A', 'B', 'V', 'G']:
                        # Try to map Russian letters
                        mapping_cat = {'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G'}
                        value = mapping_cat.get(value, 'V')
                else:
                    value = str(value).strip()

                enterprise_data[field_key] = value

            # Skip rows without name
            if not enterprise_data.get('name'):
                continue

            enterprise = Enterprise(**enterprise_data)
            db.add(enterprise)
            imported += 1

        except Exception as e:
            errors.append(f"Строка {idx + 2}: {str(e)}")

    await db.commit()

    result = {"message": f"Импортировано {imported} предприятий", "imported": imported}
    if errors:
        result["errors"] = errors[:10]  # Limit errors to first 10

    return result


# --- Interactions ---

@router.get("/{enterprise_id}/interactions", response_model=List[InteractionResponse])
async def get_interactions(
    enterprise_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get all interactions for an enterprise"""
    result = await db.execute(
        select(Interaction)
        .where(Interaction.enterprise_id == enterprise_id)
        .order_by(Interaction.date.desc())
    )
    return result.scalars().all()


@router.post("/{enterprise_id}/interactions", response_model=InteractionResponse)
async def create_interaction(
    enterprise_id: int,
    interaction: InteractionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    """Add a new interaction to an enterprise"""
    # Check enterprise exists
    result = await db.execute(select(Enterprise).where(Enterprise.id == enterprise_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Enterprise not found")

    db_interaction = Interaction(
        enterprise_id=enterprise_id,
        **interaction.model_dump()
    )
    db.add(db_interaction)
    await db.commit()
    await db.refresh(db_interaction)
    return db_interaction


@router.put("/{enterprise_id}/interactions/{interaction_id}", response_model=InteractionResponse)
async def update_interaction(
    enterprise_id: int,
    interaction_id: int,
    interaction_data: InteractionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    """Update an interaction"""
    result = await db.execute(
        select(Interaction)
        .where(Interaction.id == interaction_id, Interaction.enterprise_id == enterprise_id)
    )
    interaction = result.scalar_one_or_none()
    if not interaction:
        raise HTTPException(status_code=404, detail="Interaction not found")

    for key, value in interaction_data.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(interaction, key, value)

    await db.commit()
    await db.refresh(interaction)
    return interaction


@router.delete("/{enterprise_id}/interactions/{interaction_id}")
async def delete_interaction(
    enterprise_id: int,
    interaction_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    """Delete an interaction"""
    result = await db.execute(
        select(Interaction)
        .where(Interaction.id == interaction_id, Interaction.enterprise_id == enterprise_id)
    )
    interaction = result.scalar_one_or_none()
    if not interaction:
        raise HTTPException(status_code=404, detail="Interaction not found")

    await db.delete(interaction)
    await db.commit()
    return {"message": "Interaction deleted"}
