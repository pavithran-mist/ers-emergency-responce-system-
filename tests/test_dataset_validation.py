"""Unit tests for dataset validation rules and anomaly detection."""

import pytest
from pathlib import Path
from scripts.validate_dataset import DatasetValidator, validate_dataset


def test_validate_valid_sample_dataset():
    is_valid = validate_dataset("datasets/road_accident")
    assert is_valid is True


def test_validator_missing_directory(tmp_path):
    validator = DatasetValidator(str(tmp_path / "non_existent_folder"))
    is_valid, stats, errors, warnings = validator.validate()
    assert is_valid is False
    assert len(errors) >= 1
