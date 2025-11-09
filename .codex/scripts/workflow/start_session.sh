#!/bin/bash

DATE=$(date +"%Y-%m-%d")
HOUR=$(date +"%H")

# Map hour to shift
# morning: [5-11) -> 6 hours
# noon: [11-14) -> 3 hours
# afternoon: [14-17) -> 3 hours
# evening: [17-21) -> 4 hours
# night: [21-0) -> 3 hours
# overnight: [0-5) -> 5 hours
if [ $HOUR -ge 5 ] && [ $HOUR -lt 11 ]; then
  SHIFT="morning"
elif [ $HOUR -ge 11 ] && [ $HOUR -lt 14 ]; then
  SHIFT="noon"
elif [ $HOUR -ge 14 ] && [ $HOUR -lt 17 ]; then
  SHIFT="afternoon"
elif [ $HOUR -ge 17 ] && [ $HOUR -lt 21 ]; then
  SHIFT="evening"
elif [ $HOUR -ge 21 ] && [ $HOUR -lt 24 ]; then
  SHIFT="night"
else
  SHIFT="overnight"
fi

SESSION_ID="${DATE}-${SHIFT}"

echo $SESSION_ID