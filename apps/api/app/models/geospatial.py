from sqlalchemy import Column, Integer, String, ForeignKey
from geoalchemy2 import Geometry
from .base import Base

class District(Base):
    __tablename__ = 'districts'
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    state = Column(String, index=True)
    geometry = Column(Geometry('MULTIPOLYGON', srid=4326))

class Block(Base):
    __tablename__ = 'blocks'
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    district_id = Column(Integer, ForeignKey('districts.id'))
    geometry = Column(Geometry('MULTIPOLYGON', srid=4326))

class Panchayat(Base):
    __tablename__ = 'panchayats'
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    block_id = Column(Integer, ForeignKey('blocks.id'))
    district_id = Column(Integer, ForeignKey('districts.id'))
    geometry = Column(Geometry('MULTIPOLYGON', srid=4326))
