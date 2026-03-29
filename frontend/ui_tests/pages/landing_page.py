from selenium.webdriver.common.by import By
from pages.base_page import BasePage


class LandingPage(BasePage):
    HERO_TITLE = (By.XPATH, "//h1[contains(., 'Отчётность и рассылка')]")
    LOGIN_LINK = (By.XPATH, "//a[contains(., 'Войти')]")
    OPEN_PANEL_LINK = (By.XPATH, "//a[contains(., 'Открыть панель')]")

    def open_page(self):
        self.open("/")

    def click_login(self):
        self.click(self.LOGIN_LINK)

    def click_open_panel(self):
        self.click(self.OPEN_PANEL_LINK)