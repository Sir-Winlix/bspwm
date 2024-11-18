#!/usr/bin/env bash

#####################################
#                                   #
#  @author      : 00xWolf           #
#    GitHub    : @mmsaeed509       #
#    Developer : Mahmoud Mohamed   #
#  﫥  Copyright : Exodia OS         #
#                                   #
#####################################

# i3 config directory #
I3_DIR="$HOME/.config/i3"
PICOM=$(grep -oP 'picom = \K.*' "${I3_DIR}"/exodia.conf)

# Terminate if picom is already running
killall -q picom

# Wait until the processes have been shut down
while pgrep -u $UID -x picom >/dev/null; do sleep 1; done

# Launch picom
picom --config ${I3_DIR}/picom/${PICOM} &
