"""数据库模型 — SQLAlchemy ORM 定义"""

from sqlalchemy import create_engine, Column, Integer, String, Date, event, text
from sqlalchemy.orm import declarative_base, sessionmaker
import os

DATABASE_URL = "sqlite:///./data/data.db"

# 确保 data/ 目录存在
os.makedirs(os.path.dirname("./data/data.db"), exist_ok=True)

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False, "timeout": 30})


@event.listens_for(engine, "connect")
def _configure_sqlite(dbapi_connection, _connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA busy_timeout=30000")
    cursor.close()


SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()


class Traffic(Base):
    __tablename__ = "traffic"
    id = Column(Integer, primary_key=True)
    repo = Column(String, index=True)
    date = Column(Date, index=True)
    clones = Column(Integer)
    unique_clones = Column(Integer)
    views = Column(Integer)
    unique_views = Column(Integer)


class ReferrerTraffic(Base):
    __tablename__ = "referrer_traffic"
    id = Column(Integer, primary_key=True)
    repo = Column(String, index=True)
    date = Column(Date, index=True)
    referrer = Column(String)
    count = Column(Integer)
    uniques = Column(Integer)


class PathTraffic(Base):
    __tablename__ = "path_traffic"
    id = Column(Integer, primary_key=True)
    repo = Column(String, index=True)
    date = Column(Date, index=True)
    path = Column(String)
    count = Column(Integer)
    uniques = Column(Integer)


class RequestLog(Base):
    __tablename__ = "request_log"
    id = Column(Integer, primary_key=True)
    time = Column(String, index=True)
    ip = Column(String, index=True)
    endpoint = Column(String)
    user_agent = Column(String, default="")


# 自动建表
Base.metadata.create_all(bind=engine)


def _ensure_unique_indexes():
    """清理历史重复行，并建立业务唯一索引保证并发写入幂等。"""
    with engine.begin() as connection:
        connection.execute(text(
            "DELETE FROM traffic WHERE id NOT IN "
            "(SELECT MAX(id) FROM traffic GROUP BY repo, date)"
        ))
        connection.execute(text(
            "DELETE FROM referrer_traffic WHERE id NOT IN "
            "(SELECT MAX(id) FROM referrer_traffic GROUP BY repo, date, referrer)"
        ))
        connection.execute(text(
            "DELETE FROM path_traffic WHERE id NOT IN "
            "(SELECT MAX(id) FROM path_traffic GROUP BY repo, date, path)"
        ))
        connection.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_traffic_repo_date "
            "ON traffic (repo, date)"
        ))
        connection.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_referrer_repo_date_value "
            "ON referrer_traffic (repo, date, referrer)"
        ))
        connection.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_path_repo_date_value "
            "ON path_traffic (repo, date, path)"
        ))


_ensure_unique_indexes()
