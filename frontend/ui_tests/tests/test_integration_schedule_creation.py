import os
import time
import uuid
import requests
import psycopg
import pytest

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager


BASE_URL = os.getenv("BASE_URL", "http://localhost:5173")
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:4000")
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://sales_user:sales_pass@127.0.0.1:5432/sales"
)
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin")


@pytest.fixture
def driver():
    """
    Фикстура Selenium WebDriver.
    При желании можно включить headless-режим.
    """
    options = webdriver.ChromeOptions()
    options.add_argument("--start-maximized")
    # options.add_argument("--headless=new")

    driver = webdriver.Chrome(
        service=Service(ChromeDriverManager().install()),
        options=options
    )
    yield driver
    driver.quit()


def db_fetch_one(sql: str, params: tuple = ()):
    """
    Выполняет SQL и возвращает одну строку.
    """
    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchone()


def db_fetch_all(sql: str, params: tuple = ()):
    """
    Выполняет SQL и возвращает все строки.
    """
    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchall()


def db_execute(sql: str, params: tuple = ()):
    """
    Выполняет SQL без возврата результата.
    """
    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
        conn.commit()


def login_as_admin(driver):
    """
    Выполняет вход в админ-панель через UI.
    """
    wait = WebDriverWait(driver, 10)

    driver.get(f"{BASE_URL}/login")

    wait.until(
        EC.visibility_of_element_located(
            (By.XPATH, "//h1[contains(., 'Вход в админ-панель')]")
        )
    )

    username_input = driver.find_element(By.CSS_SELECTOR, "input[autocomplete='username']")
    password_input = driver.find_element(By.CSS_SELECTOR, "input[autocomplete='current-password']")
    submit_btn = driver.find_element(
        By.XPATH, "//button[contains(., 'Войти') or contains(., 'Входим')]"
    )

    username_input.clear()
    username_input.send_keys(ADMIN_USERNAME)

    password_input.clear()
    password_input.send_keys(ADMIN_PASSWORD)

    submit_btn.click()

    wait.until(EC.url_contains("/admin"))
    wait.until(
        EC.visibility_of_element_located(
            (By.XPATH, "//h1[contains(., 'Отчёты')]")
        )
    )


def open_schedules_page(driver):
    """
    Открывает страницу расписаний напрямую.
    """
    wait = WebDriverWait(driver, 10)

    driver.get(f"{BASE_URL}/admin/schedules")

    wait.until(
        EC.visibility_of_element_located(
            (By.XPATH, "//h1[contains(., 'Расписания')]")
        )
    )

    wait.until(
        EC.visibility_of_element_located(
            (By.XPATH, "//*[contains(., 'Создать расписание')]")
        )
    )


def test_admin_creates_schedule_api_ui_db(driver):
    """
    Сквозной интеграционный тест:
    1. Через API создаём тестового Telegram-пользователя.
    2. Через SQL убеждаемся, что пользователь появился в БД.
    3. Через SQL удаляем старые тестовые расписания, если они остались.
    4. Через UI логинимся как админ.
    5. Через UI создаём расписание рассылки.
    6. Через SQL проверяем, что:
       - в schedules появилась новая запись,
       - в schedule_recipients появилась связь с пользователем.
    """

    # -----------------------------
    # ШАГ 1. Подготовка тестовых данных через API
    # -----------------------------
    unique_suffix = uuid.uuid4().hex[:8]
    test_telegram_id = f"test-tg-{unique_suffix}"
    test_username = f"ui_api_user_{unique_suffix}"

    api_resp = requests.post(
        f"{API_BASE_URL}/api/users/telegram-register",
        json={
            "telegramId": test_telegram_id,
            "username": test_username,
            "firstName": "Test",
            "lastName": "User",
        },
        timeout=10,
    )

    assert api_resp.status_code == 200, (
        f"API не создал тестового пользователя. "
        f"status={api_resp.status_code}, body={api_resp.text}"
    )

    created_user = api_resp.json()
    assert "id" in created_user, "API не вернул id пользователя"

    test_user_id = created_user["id"]

    # -----------------------------
    # ШАГ 2. Проверка БД после API
    # -----------------------------
    db_user = db_fetch_one(
        """
        SELECT id, username, telegram_id
        FROM users
        WHERE id = %s
        """,
        (test_user_id,),
    )

    assert db_user is not None, "Пользователь не найден в БД после API"
    assert db_user[0] == test_user_id
    assert db_user[1] == test_username
    assert db_user[2] == test_telegram_id

    # -----------------------------
    # ШАГ 3. Очистка старых тестовых данных в БД
    # -----------------------------
    # Для стабильности теста удаляем старые расписания этого пользователя, если были.
    old_schedule_ids = db_fetch_all(
        """
        SELECT sr.schedule_id
        FROM schedule_recipients sr
        WHERE sr.user_id = %s
        """,
        (test_user_id,),
    )

    for (schedule_id,) in old_schedule_ids:
        db_execute("DELETE FROM schedule_recipients WHERE schedule_id = %s", (schedule_id,))
        db_execute("DELETE FROM schedules WHERE id = %s", (schedule_id,))

    remain_old = db_fetch_one(
        """
        SELECT COUNT(*)
        FROM schedule_recipients
        WHERE user_id = %s
        """,
        (test_user_id,),
    )
    assert remain_old[0] == 0, "Перед стартом теста остались старые связи расписаний"

    # -----------------------------
    # ШАГ 4. Подготовка данных для формы из БД
    # -----------------------------
    report_row = db_fetch_one(
        """
        SELECT id, name
        FROM reports
        WHERE is_active = TRUE
        ORDER BY id
        LIMIT 1
        """
    )

    assert report_row is not None, "В БД нет активного отчёта для создания расписания"

    report_id = report_row[0]
    report_name = report_row[1]

    # Возьмём уникальное время, чтобы потом легко найти запись.
    test_hour = 11
    test_minute = 47

    # На всякий случай чистим именно такое тестовое расписание.
    duplicate_schedule_ids = db_fetch_all(
        """
        SELECT s.id
        FROM schedules s
        JOIN schedule_recipients sr ON sr.schedule_id = s.id
        WHERE s.report_id = %s
          AND s.hour = %s
          AND s.minute = %s
          AND s.frequency = 'DAILY'
          AND sr.user_id = %s
        """,
        (report_id, test_hour, test_minute, test_user_id),
    )

    for (schedule_id,) in duplicate_schedule_ids:
        db_execute("DELETE FROM schedule_recipients WHERE schedule_id = %s", (schedule_id,))
        db_execute("DELETE FROM schedules WHERE id = %s", (schedule_id,))

    # Контрольная SQL-проверка перед UI
    before_count = db_fetch_one(
        """
        SELECT COUNT(*)
        FROM schedules s
        JOIN schedule_recipients sr ON sr.schedule_id = s.id
        WHERE s.report_id = %s
          AND s.hour = %s
          AND s.minute = %s
          AND s.frequency = 'DAILY'
          AND sr.user_id = %s
        """,
        (report_id, test_hour, test_minute, test_user_id),
    )
    assert before_count[0] == 0, "Перед UI-шагом уже существует такое расписание"

    # -----------------------------
    # ШАГ 5. Логин через UI
    # -----------------------------
    login_as_admin(driver)

    # После логина можно дополнительно проверить локальное состояние браузера
    auth_token = driver.execute_script("return localStorage.getItem('authToken');")
    assert auth_token, "После логина authToken не записан в localStorage"

    # -----------------------------
    # ШАГ 6. Открытие страницы расписаний через UI
    # -----------------------------
    open_schedules_page(driver)
    wait = WebDriverWait(driver, 10)

    # Проверяем, что страница загрузила справочники
    wait.until(
        EC.presence_of_element_located(
            (By.XPATH, "//label[contains(., 'Отчёт')]//select")
        )
    )
    wait.until(
        EC.presence_of_all_elements_located(
            (By.CSS_SELECTOR, "input[type='checkbox']")
        )
    )

    # -----------------------------
    # ШАГ 7. Заполнение формы через UI
    # -----------------------------
    report_select_el = wait.until(
        EC.visibility_of_element_located(
            (By.XPATH, "//label[contains(., 'Отчёт')]//select")
        )
    )
    Select(report_select_el).select_by_value(str(report_id))

    hour_input = driver.find_element(
        By.XPATH, "//label[contains(., 'Время (час)')]//input"
    )
    minute_input = driver.find_element(
        By.XPATH, "//label[contains(., 'Время (минута)')]//input"
    )
    frequency_select = driver.find_element(
        By.XPATH, "//label[contains(., 'Частота')]//select"
    )

    hour_input.clear()
    hour_input.send_keys(str(test_hour))

    minute_input.clear()
    minute_input.send_keys(str(test_minute))

    Select(frequency_select).select_by_visible_text("Ежедневно")

    # Отмечаем чекбокс нужного пользователя.
    # Ищем лейбл/текст по username и кликаем связанный чекбокс.
    user_checkbox = wait.until(
        EC.element_to_be_clickable(
            (
                By.XPATH,
                f"//label[contains(., '{test_username}')]//input[@type='checkbox']"
            )
        )
    )
    user_checkbox.click()

    # Проверяем, что кнопка создания стала активной
    create_button = driver.find_element(
        By.XPATH, "//button[contains(., 'Создать') or contains(., 'Создание')]"
    )
    assert create_button.is_enabled(), "Кнопка 'Создать' неактивна, форма заполнена не полностью"

    # -----------------------------
    # ШАГ 8. Создание расписания через UI
    # -----------------------------
    create_button.click()

    # Ждём, пока форма сбросится или на странице появится созданная запись
    # Так как список schedules обновляется локально setSchedules(...),
    # обычно новая запись появляется сразу.
    wait.until(
        EC.presence_of_element_located(
            (
                By.XPATH,
                f"//*[contains(., '{report_name}') and contains(., '{test_username}')]"
            )
        )
    )

    # -----------------------------
    # ШАГ 9. Проверка БД после UI-действия
    # -----------------------------
    created_schedule = db_fetch_one(
        """
        SELECT s.id, s.report_id, s.hour, s.minute, s.frequency, s.weekday, s.is_active
        FROM schedules s
        JOIN schedule_recipients sr ON sr.schedule_id = s.id
        WHERE s.report_id = %s
          AND s.hour = %s
          AND s.minute = %s
          AND s.frequency = 'DAILY'
          AND sr.user_id = %s
        ORDER BY s.id DESC
        LIMIT 1
        """,
        (report_id, test_hour, test_minute, test_user_id),
    )

    assert created_schedule is not None, "После UI-создания запись в schedules не появилась"

    schedule_id = created_schedule[0]

    assert created_schedule[1] == report_id
    assert created_schedule[2] == test_hour
    assert created_schedule[3] == test_minute
    assert created_schedule[4] == "DAILY"
    assert created_schedule[5] is None
    assert created_schedule[6] is True

    created_recipient = db_fetch_one(
        """
        SELECT schedule_id, user_id
        FROM schedule_recipients
        WHERE schedule_id = %s AND user_id = %s
        """,
        (schedule_id, test_user_id),
    )

    assert created_recipient is not None, (
        "После UI-создания не появилась связь в schedule_recipients"
    )

    # -----------------------------
    # ШАГ 10. Финальная очистка тестовых данных
    # -----------------------------
    db_execute("DELETE FROM schedule_recipients WHERE schedule_id = %s", (schedule_id,))
    db_execute("DELETE FROM schedules WHERE id = %s", (schedule_id,))
    db_execute("DELETE FROM users WHERE id = %s", (test_user_id,))

    # Контроль очистки
    deleted_schedule = db_fetch_one(
        "SELECT id FROM schedules WHERE id = %s",
        (schedule_id,),
    )
    deleted_user = db_fetch_one(
        "SELECT id FROM users WHERE id = %s",
        (test_user_id,),
    )

    assert deleted_schedule is None, "Тестовое расписание не удалилось после теста"
    assert deleted_user is None, "Тестовый пользователь не удалился после теста"