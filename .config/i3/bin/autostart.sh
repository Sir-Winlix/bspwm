#!/usr/bin/env bash

#####################################
#                                   #
#  @author      : 00xWolf           #
#    GitHub    : @mmsaeed509       #
#    Developer : Mahmoud Mohamed   #
#  﫥  Copyright : Exodia OS         #
#                                   #
#####################################

# Environtment path #
export PATH="${PATH}:$HOME/.config/i3/bin:$HOME/.config/i3/rofi/bin:$HOME/.local/bin"

# i3 config directory #
I3_DIR="$HOME/.config/i3"


# Kill already running process #
_ps=(picom dunst ksuperkey mpd xfce-polkit xfce4-power-manager xsettingsd)
for _prs in "${_ps[@]}";
		
		do

		if [[ `pidof ${_prs}` ]];
			
			then
				
				killall -9 ${_prs}

		fi

done

# Fix cursor #
xsetroot -cursor_name left_ptr

# Polkit agent #
/usr/lib/xfce-polkit/xfce-polkit &

# Enable power management #
xfce4-power-manager &

# Enable Super Keys For Menu #
ksuperkey -e 'Super_L=Alt_L|F1' &
ksuperkey -e 'Super_R=Alt_L|F1' &

# Lauch xsettingsd daemon #
xsettingsd --config="${I3_DIR}"/xsettingsd &

# Restore wallpaper #
feh --no-fehbg --bg-fill $(grep -oP 'background = \K.*' "${I3_DIR}/exodia.conf")

# set keyboard Layouts #
setxkbmap -layout $(grep -oP 'keyboard-layouts = \K.*' "${I3_DIR}/exodia.conf")
setxkbmap -option 'grp:alt_shift_toggle'

# No. monitors #
NUM_OF_MONITORS=$(xrandr --listmonitors | grep -c "^ ")

if [[ ${NUM_OF_MONITORS} -ge 1 ]];
	
	then

    	i3monitors
		
fi

# Lauch notification daemon #
i3dunst.sh

# Lauch polybar #
i3bar.sh

# Lauch compositor #
i3comp.sh

# update colors #
i3colors

# Start mpd #
exec mpd &

# Lauch Exodia OS Assistant #
STATUS=$(grep -Po 'exodia-assistant-auto-start\s*=\s*\K.*' ${I3_DIR}/exodia.conf)

if [[ ${STATUS} == "true" ]];
	
	then

    	exodia-assistant
		
fi
