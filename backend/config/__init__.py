"""Support MySQL sans mysqlclient (utile sur Vercel, pas de lib système requise).
Uniquement activé quand DB_ENGINE=mysql ; aucun effet en SQLite.
"""
import os
from pathlib import Path

try:
    from dotenv import load_dotenv

    # .env est normalement chargé dans settings.py, mais ce module s'exécute AVANT :
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:  # pragma: no cover
    pass

if os.getenv("DB_ENGINE", "").lower() == "mysql":
    import pymysql

    pymysql.version_info = (2, 2, 8, "final", 0)  # équivaut à mysqlclient 2.2.8 >= 2.2.1
    pymysql.install_as_MySQLdb()
