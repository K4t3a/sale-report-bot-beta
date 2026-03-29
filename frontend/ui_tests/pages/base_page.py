from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


class BasePage:
    def __init__(self, driver, base_url, timeout=10):
        self.driver = driver
        self.base_url = base_url
        self.wait = WebDriverWait(driver, timeout)

    def open(self, path=""):
        self.driver.get(f"{self.base_url}{path}")

    def wait_visible(self, locator):
        return self.wait.until(EC.visibility_of_element_located(locator))

    def wait_clickable(self, locator):
        return self.wait.until(EC.element_to_be_clickable(locator))

    def click(self, locator):
        self.wait_clickable(locator).click()

    def type(self, locator, text):
        el = self.wait_visible(locator)
        el.clear()
        el.send_keys(text)

    def get_text(self, locator):
        return self.wait_visible(locator).text

    def is_visible(self, locator):
        try:
            self.wait_visible(locator)
            return True
        except Exception:
            return False