from tests.helpers import login_as_admin
from pages.logs_page import LogsPage


def test_logs_page_opens(driver, base_url, credentials):
    login_as_admin(driver, base_url, credentials)

    page = LogsPage(driver, base_url)
    page.open_page()

    assert page.is_opened(), "Страница логов не открылась"
    assert page.has_table() or page.has_empty_state(), "Нет ни таблицы логов, ни пустого состояния"