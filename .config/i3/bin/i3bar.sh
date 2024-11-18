#!/usr/bin/env bash

#####################################
#                                   #
#  @author      : 00xWolf           #
#    GitHub    : @mmsaeed509       #
#    Developer : Mahmoud Mohamed   #
#  﫥  Copyright : Exodia OS         #
#                                   #
#####################################

# Files and Directories #
I3_DIR="$HOME/.config/i3"

# get the theme name to launch its bar #
THEME=$(grep -Po 'polybar\s*=\s*\K.*' ${I3_DIR}/exodia.conf)

# launch polybar #
bash "${I3_DIR}"/themes/"${THEME}"/polybar/launch.sh
