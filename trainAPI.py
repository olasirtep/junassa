import urllib.request
import json
import dateutil.parser as dp
from datetime import date, datetime
from database import *


latestVersion = 0
stations = {}
stationLongitude = {}
stationLatitude = {}
trains = False
trainsIndex = {}

def fetchMeta() :
	global stations
	global stationLongitude
	global stationLatitude
	# Get station names and locations
	#print("Requesting stations from Digitraffic...")
	response = urllib.request.urlopen("https://rata.digitraffic.fi/api/v1/metadata/stations").read()
	stationdata = json.loads(response.decode("utf-8"))


	for station in stationdata :
		#print(station["stationShortCode"], "=", station["stationName"])
		stations.update({station["stationShortCode"]:station["stationName"]})
		stationLongitude.update({station["stationShortCode"]:station["longitude"]})
		stationLatitude.update({station["stationShortCode"]:station["latitude"]})

def fetchTrains() :
	global trains
	global trainsIndex
	today = date.today().isoformat()
	print ("Requesting todays trains from Digitraffic...")
	response = urllib.request.urlopen("https://rata.digitraffic.fi/api/v1/trains/"+today).read()
	trains = json.loads(response.decode('utf-8'))
	i = 0
	#print("Bulding index of trains...")
	for train in trains :
		trainsIndex.update({train["trainNumber"]:i})

def cleanTables() :
	# We empty the database
	sql = "DELETE from trains WHERE 1"
	cursor.execute(sql)
	print("Deleting 'trains'")
	db.commit()

	sql = "DELETE from timetables WHERE 1"
	cursor.execute(sql)
	print("Deleting 'timetables'")
	db.commit()

def init() :
	global latestVersion
	global stations
	global stationLongitude
	global stationLatitude
	global trains

	initTime = datetime.utcnow().timestamp()

	cleanTables()
	fetchMeta()
	fetchTrains()

	print("Requesting train locations from Digitraffic...")
	response = urllib.request.urlopen("https://rata.digitraffic.fi/api/v1/train-locations/latest/").read()
	locations = json.loads(response.decode('utf-8'))

	
	for train in trains :
		latestVersion = train["version"] if train["version"] > latestVersion else latestVersion
		trainID = train["trainNumber"]
		trainType = train["commuterLineID"] if train["commuterLineID"] != "" else train["trainType"]
		speed = 0
		longitude = 0
		latitude = 0

		for location in locations :
			if (location["trainNumber"] == trainID) :
				speed = location["speed"]
				longitude = location["location"]["coordinates"][0]
				latitude = location["location"]["coordinates"][1]
				break

		firstStation = stations[train["timeTableRows"][0]["stationShortCode"]]
		lastStation = stations[train["timeTableRows"][-1]["stationShortCode"]]
		sql = "INSERT INTO trains (id, speed, longitude, latitude, train_type, first_station, last_station, last_update) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)"
		val = (trainID, speed, longitude, latitude, trainType, firstStation, lastStation, initTime)
		#print(val)
		cursor.execute(sql,val)
		#print("Inserting train", train["trainNumber"], "into database...")
		db.commit()

		#print("Going through stops for", train["trainNumber"])
		order = 0
		departureTime = False
		arrivalTime = False
		departedTime = False
		arrivedTime = False
		stops = len(train["timeTableRows"])/2
		for station in train["timeTableRows"] :
			if (departureTime != False and arrivalTime != False) :
				departureTime = False
				arrivalTime = False
				departedTime = False
				arrivedTime = False
			#print("Train:",train["trainNumber"],"Station:",stations[station["stationShortCode"]])
			stationName = stations[station["stationShortCode"]]
			arrivalTime = station["scheduledTime"] if station["type"] == "ARRIVAL" else arrivalTime
			departureTime = station["scheduledTime"] if station["type"] == "DEPARTURE" else departureTime
			arrivedTime = station.get('actualTime', "") if station["type"] == "ARRIVAL" else arrivedTime
			departedTime = station.get('actualTime', "") if station["type"] == "DEPARTURE" else departedTime
			longitude = stationLongitude[station["stationShortCode"]]
			latitude = stationLatitude[station["stationShortCode"]]
			if (departureTime != False and arrivalTime != False or order == 0 or order == stops) :
				arrivalTime = dp.parse(arrivalTime).strftime('%s') if arrivalTime else 0
				departureTime = dp.parse(departureTime).strftime('%s') if departureTime else 0
				arrivedTime = dp.parse(arrivedTime).strftime('%s') if arrivedTime else 0
				departedTime = dp.parse(departedTime).strftime('%s') if departedTime else 0
				trainStopping = station["trainStopping"]
				sql = "INSERT INTO `timetables`(`id`, `station`, `train_stopping`, `arrival`, `departure`, `arrived`, `departed`, `order`, `longitude`, `latitude`, `last_update`) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)"
				val = (trainID, stationName, trainStopping, arrivalTime, departureTime, arrivedTime, departedTime, order, longitude, latitude, initTime)
				order += 1
				cursor.execute(sql,val)
				db.commit()
				departureTime = True
				arrivalTime = True

def update() :
	global latestVersion
	global trains
	print(datetime.utcnow().isoformat())
	updateTime = datetime.utcnow().timestamp()

	#print("LATEST VERSION:",str(latestVersion))
	#print("Getting latest traininfo...")
	response = urllib.request.urlopen("https://rata.digitraffic.fi/api/v1/trains?version="+str(latestVersion)).read()
	trains = json.loads(response.decode('utf-8'))

	#print("Updating database...")
	for train in trains :
		latestVersion = train["version"] if train["version"] > latestVersion else latestVersion
		sql = "DELETE FROM timetables WHERE id = "+str(train["trainNumber"])	
		cursor.execute(sql)
		trainID = train["trainNumber"]	
		departureTime = False
		arrivalTime = False
		departedTime = False
		arrivedTime = False
		order = 0
		stops = len(train["timeTableRows"])/2

		for station in train["timeTableRows"] :
			if (departureTime != False and arrivalTime != False) :
				departureTime = False
				arrivalTime = False
				departedTime = False
				arrivedTime = False
			try:
				stationName = stations[station["stationShortCode"]]
			except KeyError:
				fetchMeta()
				try:
					stationName = stations[station["stationShortCode"]]
				except KeyError:
					continue
			arrivalTime = station["scheduledTime"] if station["type"] == "ARRIVAL" else arrivalTime
			departureTime = station["scheduledTime"] if station["type"] == "DEPARTURE" else departureTime
			arrivedTime = station.get('actualTime', "") if station["type"] == "ARRIVAL" else arrivedTime
			departedTime = station.get('actualTime', "") if station["type"] == "DEPARTURE" else departedTime
			longitude = stationLongitude[station["stationShortCode"]]
			latitude = stationLatitude[station["stationShortCode"]]
			
			if (departureTime != False and arrivalTime != False or order == 0 or order == stops) :
				arrivalTime = dp.parse(arrivalTime).strftime('%s') if arrivalTime else 0
				departureTime = dp.parse(departureTime).strftime('%s') if departureTime else 0
				arrivedTime = dp.parse(arrivedTime).strftime('%s') if arrivedTime else 0
				departedTime = dp.parse(departedTime).strftime('%s') if departedTime else 0
				trainStopping = station["trainStopping"]
				sql = "INSERT INTO `timetables`(`id`, `station`, `train_stopping`, `arrival`, `departure`, `arrived`, `departed`, `order`, `longitude`, `latitude`, `last_update`) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)"
				val = (trainID, stationName, trainStopping, arrivalTime, departureTime, arrivedTime, departedTime, order, longitude, latitude,updateTime)
				order += 1
				cursor.execute(sql,val)
				db.commit()
				departureTime = True
				arrivalTime = True


	#print("Getting latest locations...")
	response = urllib.request.urlopen("https://rata.digitraffic.fi/api/v1/train-locations/latest/").read()
	locations = json.loads(response.decode('utf-8'))

	#print("Updating database...")
	for train in locations :
		sql = "UPDATE trains SET speed=%s, longitude=%s, latitude=%s, last_update=%s WHERE id=%s"
		speed = train["speed"]
		longitude = train["location"]["coordinates"][0]
		latitude = train["location"]["coordinates"][1]
		val = (speed, longitude, latitude, updateTime, train["trainNumber"])
		cursor.execute(sql,val)
	db.commit()
