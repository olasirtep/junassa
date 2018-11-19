import time
from trainAPI import *

if __name__ == "__main__" :
	locationsT = time.time()
	timetablesT = time.time()
	init()
	lastSecond = 0
	while(True) :
		time.sleep(1)
		if (time.time() - locationsT >= 5) :
			locationsT = time.time()
			try :
				print("Updating train locations...")
				updateLocations()
				print("Update took",time.time()-locationsT,"seconds")
			except urllib.error.HTTPError :
				print("!!! Location update failed with HTTPError!")
		if (time.time() - timetablesT >= 30) :
			timetablesT = time.time()
			try :
				print("Updating timetables...")
				updateTimetables()
				print("Update took",time.time()-timetablesT,"seconds")
			except urllib.error.HTTPError :
				print("!!! Location update failed with HTTPError!")
	db.close()
