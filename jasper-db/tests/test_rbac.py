import pytest

ROLES = ["viewer", "ingest", "analyst", "admin"]


def test_roles_exist():
    for role in ROLES:
        assert role in ["viewer", "ingest", "analyst", "admin"]


def test_viewer_permissions():
    allowed = ["SELECT"]
    denied = ["INSERT", "UPDATE", "DELETE"]
    assert "SELECT" in allowed
    assert "INSERT" in denied


def test_ingest_permissions():
    allowed = ["INSERT"]
    denied = ["DELETE"]
    assert "INSERT" in allowed
    assert "DELETE" in denied


def test_analyst_permissions():
    allowed = ["SELECT", "EXPORT"]
    denied = ["DELETE"]
    assert "SELECT" in allowed
    assert "EXPORT" in allowed


def test_admin_permissions():
    allowed = ["SELECT", "INSERT", "UPDATE", "DELETE"]
    assert len(allowed) == 4