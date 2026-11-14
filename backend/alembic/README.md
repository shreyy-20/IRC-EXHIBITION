Alembic is configured in `alembic.ini` and `alembic/env.py`.

After installing backend requirements and starting PostgreSQL:
```powershell
alembic revision --autogenerate -m "initial schema"
alembic upgrade head
```
Inspect every generated migration before applying it to a shared or production database. The app still has development `create_all` bootstrap enabled; disable that startup behaviour once migrations are adopted in the next hardening pass.
