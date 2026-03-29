from selenium.webdriver.common.by import By
from pages.base_page import BasePage


class DashboardPage(BasePage):
    TITLE = (By.XPATH, "//h1[contains(., 'Отчёты')]")
    GENERATE_BUTTON = (By.XPATH, "//button[contains(., 'Сформировать отчёт') or contains(., 'Генерация')]")
    DOWNLOAD_BUTTON = (By.XPATH, "//button[contains(., 'Скачать CSV')]")
    SUMMARY_BLOCK = (By.XPATH, "//*[contains(., 'Сводка за период')]")
    ERROR_BADGE = (By.CSS_SELECTOR, ".badge-danger")

    def open_page(self):
        self.open("/admin")

    def is_opened(self):
        return self.is_visible(self.TITLE)

    def click_generate(self):
        self.click(self.GENERATE_BUTTON)

    def is_summary_visible(self):
        return self.is_visible(self.SUMMARY_BLOCK)

    def is_download_button_visible(self):
        return self.is_visible(self.DOWNLOAD_BUTTON)