from tests.helpers import login_as_admin
from pages.dashboard_page import DashboardPage


def test_dashboard_elements_visible(driver, base_url, credentials):
    login_as_admin(driver, base_url, credentials)
    dashboard = DashboardPage(driver, base_url)

    assert dashboard.is_opened(), "Страница dashboard не открылась"
    assert dashboard.is_summary_visible(), "Нет блока 'Сводка за период'"
    assert dashboard.is_download_button_visible(), "Нет кнопки скачивания CSV"


def test_generate_report(driver, base_url, credentials):
    login_as_admin(driver, base_url, credentials)
    dashboard = DashboardPage(driver, base_url)

    dashboard.click_generate()

    # Минимальная проверка: страница осталась открыта, ошибки нет или появилась сводка
    assert dashboard.is_opened(), "После генерации отчёта dashboard недоступен"