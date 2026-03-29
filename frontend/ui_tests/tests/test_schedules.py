from tests.helpers import login_as_admin
from pages.schedules_page import SchedulesPage


def test_schedules_page_opens(driver, base_url, credentials):
    login_as_admin(driver, base_url, credentials)

    page = SchedulesPage(driver, base_url)
    page.open_page()

    assert page.is_opened(), "Страница расписаний не открылась"
    assert page.is_visible(page.CREATE_BLOCK), "Нет блока создания расписания"
    assert page.is_visible(page.EXISTING_TABLE), "Нет блока существующих расписаний"


def test_create_schedule_form(driver, base_url, credentials):
    login_as_admin(driver, base_url, credentials)

    page = SchedulesPage(driver, base_url)
    page.open_page()

    assert page.is_opened(), "Страница расписаний не открылась"

    page.fill_form(frequency="DAILY")
    page.select_first_user()
    page.click_create()

    assert page.is_opened(), "После создания расписания страница сломалась"