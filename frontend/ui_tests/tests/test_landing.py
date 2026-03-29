from pages.landing_page import LandingPage
from pages.login_page import LoginPage


def test_landing_open_login_page(driver, base_url):
    landing = LandingPage(driver, base_url)
    login = LoginPage(driver, base_url)

    landing.open_page()
    assert landing.is_visible(landing.HERO_TITLE), "Не открылся лендинг"

    landing.click_login()
    assert login.is_opened(), "Переход на страницу логина не выполнен"