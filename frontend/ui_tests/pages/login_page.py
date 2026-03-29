from selenium.webdriver.common.by import By
from pages.base_page import BasePage


class LoginPage(BasePage):
    TITLE = (By.XPATH, "//h1[contains(., 'Вход в админ-панель')]")
    USERNAME_INPUT = (By.CSS_SELECTOR, "input[autocomplete='username']")
    PASSWORD_INPUT = (By.CSS_SELECTOR, "input[autocomplete='current-password']")
    SUBMIT_BUTTON = (By.XPATH, "//button[contains(., 'Войти') or contains(., 'Входим')]")
    ERROR_BADGE = (By.CSS_SELECTOR, ".badge-danger")

    def open_page(self):
        self.open("/login")

    def login(self, username, password):
        self.type(self.USERNAME_INPUT, username)
        self.type(self.PASSWORD_INPUT, password)
        self.click(self.SUBMIT_BUTTON)

    def is_opened(self):
        return self.is_visible(self.TITLE)

    def get_error_text(self):
        return self.get_text(self.ERROR_BADGE)