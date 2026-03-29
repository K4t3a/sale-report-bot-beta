# tests/helpers.py
from pages.login_page import LoginPage
from pages.dashboard_page import DashboardPage


def login_as_admin(driver, base_url, credentials):
    login_page = LoginPage(driver, base_url)
    dashboard_page = DashboardPage(driver, base_url)

    login_page.open_page()
    login_page.login(credentials["username"], credentials["password"])

    assert dashboard_page.is_opened(), "После входа не открылась админ-панель"