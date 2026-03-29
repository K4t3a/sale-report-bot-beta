from selenium.webdriver.common.by import By
from pages.base_page import BasePage


class LogsPage(BasePage):
    TITLE = (By.XPATH, "//h1[contains(., 'Логи отправки')]")
    REPORT_FILTER = (By.XPATH, "//span[contains(., 'Отчёт')]/parent::label//select")
    USER_FILTER = (By.XPATH, "//span[contains(., 'Пользователь')]/parent::label//select")
    TABLE = (By.XPATH, "//table")
    EMPTY_TEXT = (By.XPATH, "//*[contains(., 'Логов нет.')]")
    LOADING_TEXT = (By.XPATH, "//*[contains(., 'Загрузка')]")

    def open_page(self):
        self.open("/admin/logs")

    def is_opened(self):
        return self.is_visible(self.TITLE)

    def has_table(self):
        return self.is_visible(self.TABLE)

    def has_empty_state(self):
        return self.is_visible(self.EMPTY_TEXT)