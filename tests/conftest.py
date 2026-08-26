"""Pytest global configuration and fixtures."""

import pytest
from backend.app.database import engine, Base, SessionLocal
from backend.app.main import seed_initial_database_data


@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    """Create all database tables and seed test data before running tests."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_initial_database_data(db)
    finally:
        db.close()
    yield
