import os
import pytest
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

BASE_URL = os.getenv("BASE_URL", "http://localhost:5173")
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin")


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def credentials():
    return {
        "username": ADMIN_USERNAME,
        "password": ADMIN_PASSWORD,
    }


@pytest.fixture
def driver():
    options = Options()
    options.add_argument("--start-maximized")
    # options.add_argument("--headless=new")  # включишь при необходимости

    driver = webdriver.Chrome(options=options)
    yield driver
    driver.quit()