import mysql.connector
from secrets import *

db = mysql.connector.connect(
  host=hostname,
  user=username,
  passwd=password,
  database=database
)

cursor = db.cursor()
