from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select
from pages.base_page import BasePage


class SchedulesPage(BasePage):
    TITLE = (By.XPATH, "//h1[contains(., 'Расписания')]")
    CREATE_BLOCK = (By.XPATH, "//*[contains(., 'Создать расписание')]")
    REPORT_SELECT = (By.XPATH, "//label[contains(., 'Отчёт')]//select")
    HOUR_INPUT = (By.XPATH, "//label[contains(., 'Время (час)')]//input")
    MINUTE_INPUT = (By.XPATH, "//label[contains(., 'Время (минута)')]//input")
    FREQUENCY_SELECT = (By.XPATH, "//label[contains(., 'Частота')]//select")
    WEEKDAY_SELECT = (By.XPATH, "//label[contains(., 'День недели')]//select")
    CREATE_BUTTON = (By.XPATH, "//button[contains(., 'Создать') or contains(., 'Создание')]")
    EXISTING_TABLE = (By.XPATH, "//*[contains(., 'Существующие расписания')]")
    CHECKBOXES = (By.CSS_SELECTOR, "input[type='checkbox']")
    ERROR_BADGE = (By.CSS_SELECTOR, ".badge-danger")

    def open_page(self):
        self.open("/admin/schedules")

    def is_opened(self):
        return self.is_visible(self.TITLE)

    def fill_form(self, report_index=1, hour="9", minute="0", frequency="DAILY", weekday="1"):
        Select(self.wait_visible(self.REPORT_SELECT)).select_by_index(report_index)
        self.type(self.HOUR_INPUT, hour)
        self.type(self.MINUTE_INPUT, minute)
        Select(self.wait_visible(self.FREQUENCY_SELECT)).select_by_visible_text(
            "Ежедневно" if frequency == "DAILY" else "Еженедельно"
        )
        if frequency == "WEEKLY":
            Select(self.wait_visible(self.WEEKDAY_SELECT)).select_by_value(weekday)

    def select_first_user(self):
        checkboxes = self.driver.find_elements(*self.CHECKBOXES)
        if checkboxes:
            checkboxes[0].click()

    def click_create(self):
        self.click(self.CREATE_BUTTON)

    def get_error_text(self):
        return self.get_text(self.ERROR_BADGE)