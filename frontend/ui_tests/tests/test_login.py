from pages.login_page import LoginPage
from pages.dashboard_page import DashboardPage


def test_login_invalid_credentials(driver, base_url):
    login = LoginPage(driver, base_url)

    login.open_page()
    assert login.is_opened(), "Страница логина не открылась"

    login.login("wrong", "wrong")

    error_text = login.get_error_text().lower()
    assert (
        "неверный" in error_text
        or "логин" in error_text
        or "пароль" in error_text
    ), f"Неожиданный текст ошибки: {error_text}"


def test_login_valid_credentials(driver, base_url, credentials):
    login = LoginPage(driver, base_url)
    dashboard = DashboardPage(driver, base_url)

    login.open_page()
    login.login(credentials["username"], credentials["password"])

    assert dashboard.is_opened(), "После успешного входа dashboard не открылся"
    assert "/admin" in driver.current_url