import time
from trainAPI import *

if __name__ == "__main__" :
	t = time.time()
	init()
	#print("INIT READY")
	interval = 5
	lastSecond = 0
	#print("Waiting 5 seconds to next update run...")
	while(True) :
		time.sleep(1)
		if (time.time()-lastSecond >= 1) :
			#print(interval)
			interval -= 1
			lastSecond = time.time()
		if (time.time() - t >= 5) :
			interval = 5
			t = time.time()
			update()
			print("Update took",time.time()-t,"seconds")
			#print("Waiting 5 seconds to next update run...")
	db.close()
