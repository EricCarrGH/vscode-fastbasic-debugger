dim _f(3000)b.,h,_torch,_lastMask,_jumping

' Payload size: 1460, Compressed size: 784, RLE from 200 to 223, Mappings needed: Quote $22/34=35
'da.q()b.=""$00$15$CA$55$2E$00$CB$55$AB$00$60$5C$C8$58$6C$B0$00$C8$FF$C8$AA$55$00$C8$FF$C8$AA$56$CA$00$0A$AA$55$C8$00$0F$C8$AA$55$00$0F$FF$FF$C8$AA$55$00$C9$FF$AB$A0$0F$00$C8$FF$F0$0F$FF$FF$00$FF$F0$0F$CA$FF$CA$BF$B0$0F$C9$FF$F0$03$F3$F3$FF$FF$F0$0F$C9$FF$C9$F3$F0$0F$C8$FF$C9$BF$B0$8A$55$C8$FF$F0$0F$FE$AA$55$00$F9$F5$F5$A5$A5$A0$55$0A$CA$5A$58$A2$0A$C9$5A$60$0F$55$F0$C0$30$CA$F0$33$0C$33$0C$33$0C$33$0C$3C$3C$C8$0C$C9$00$30$0C$3F$FC$3C$30$3C$00$00$0C$30$0C$3C$30$3C$00$0C$00$FC$3F$3C$0C$30$FF$F0$0F$FF$FA$AA$AA$55$00$09$CA$05$0A$FF$CA$BF$B0$00$C9$FF$F0$C8$00$FF$FF$F0$CB$00$C9$FF$AB$A0$00$00$C8$FF$F0$C9$00$FF$F0$D6$00$1C$13$16$15$1C$13$16$15$12$14$04$05$D1$00$01$02$02$03$02$03$01$02$03$01$02$02$01$02$02$03$01$03$01$02$01$C8$02$0C$0D$0E$00,
'da.b.=""$0C$0F$0E$00$10$11$1B$05$0C$0F$0E$00$0C$0F$0E$00$1D$1E$1F$00$00$B1$C8$00$17$00$00$C8$04$05$CD$00$06$07$08$05$CD$00$09$0A$0B$DF$00$CC$00$20$21$23$CE$00$C8$04$05$C9$00$38$7C$60$20$00$30$C8$18$00$30$C8$20$D6$00$1C$3E$30$10$00$18$08$08$18$18$1C$3C$20$D5$00$1C$3E$30$10$00$18$0C$1C$1C$18$1C$3C$76$06$D6$00$1C$3E$30$10$00$18$08$08$04$10$1C$1C$18$08$D4$00$1C$3E$30$10$00$18$18$10$10$18$3C$36$74$20$D5$00$18$3C$24$20$00$30$60$70$70$60$70$38$38$10$DA$00$0E$1F$18$08$30$7C$F0$F0$78$10$D7$00$0E$1F$18$08$30$7C$F0$F0$E0$E0$60$D6$00$1C$38$30$18$00$0C$06$06$0E$0C$0C$06$06$04$D7$00$1C$38$30$18$1C$04$04$38$30$38$1C$D5$00$38$70$60$30$00$18$2C$20$3C$38$C8$18$08$D5$00$30$70$60$30$00$00$0C$C8$1C$18$18$38$30$D4$00$06$1F$33$73$4A$E0$F0$E0$E0$60$D6$00$06$1F$33,
'da.b.=""$73$7A$F0$70$20$80$40$DF$00$00$06$0F$0C$04$1E$32$00$3C$70$70$30$D5$00$18$3C$24$20$00$30$60$70$30$3C$3E$76$60$20$DF$00$00$60$F1$3B$73$D4$00$38$7C$70$38$30$00$C8$20$30$C9$00$30$38$D4$00$1C$3E$38$1C$18$00$14$14$C8$20$02$06$64$70$D3$00$1C$3E$38$1C$18$00$31$43$80$80$00$00$80$C0$86$07$D4$00$1C$3E$38$1C$18$00$10$10$18$0C$00$02$06$10$1C$D3$00$1C$3E$38$1C$18$00$00$2A$4E$C9$00$C6$C7$60$D3$00$18$3D$3F$3B$36$0C$18$CB$00$08$0C$06$D8$00$0E$1F$1C$0E$0C$00$0C$0C$06$23$3B$D6$00$0E$1F$1C$0E$0C$00$0C$0C$C8$04$60$70$D4$00$1C$3C$3E$1C$0C$00$18$18$30$30$20$00$00$08$0E$D6$00$1C$3C$3E$1C$C0$78$18$C9$00$18$0C$D3$00$38$78$7C$38$18$01$13$1E$CA$00$10$18$0C$D0$00$0C$0C$04$3C$7C$7C$38$18$18$10$CB$00$40$60$20$D2$00$06$C8$0F$32$18$0C$C8$00$60$70$D4$00$06$C8$0F$02,
'da.b.=""$08$8C$C4$76$3A$DF$00$00$06$0F$0E$07$00$0C$FC$C0$C8$00$30$38$D3$00$18$3C$3D$3B$36$0C$18$CA$00$06$C7$C0$80$DC$00$30$18$8A$0F$87$8F$B8$CF$00
'i=&q+1:m.i+245,i+244,247:m.i+493,i+491,247:m.i+741,i+738,46:f._c=0t.1459:i.h:de.h:el.:k=p.i:i.k>199a.k<224:h=k-198:inci:k=p.i:e.:inci:e.:i.k=35t.k=34:_f(_c)=k:n.


' Payload size: 1460, Compressed size: 809, RLE from 208 to 223, Mappings needed: Quote $22/34=35
da.q()b.=""$00$15$D2$55$2A$00$D3$55$AB$00$60$5C$D0$58$6C$B0$00$D0$FF$D0$AA$55$00$D0$FF$D0$AA$56$D2$00$0A$AA$55$D0$00$0F$D0$AA$55$00$0F$FF$FF$D0$AA$55$00$D1$FF$AB$A0$0F$00$D0$FF$F0$0F$FF$FF$00$FF$F0$0F$D2$FF$D2$BF$B0$0F$D1$FF$F0$03$F3$F3$FF$FF$F0$0F$D1$FF$D1$F3$F0$0F$D0$FF$D1$BF$B0$8A$55$D0$FF$F0$0F$FE$AA$55$3F$C0$FF$FF$D0$AA$55$00$95$D2$55$AA$00$95$D0$55$56$00$55$3F$CF$3F$CC$33$CF$3F$CF$A3$A0$A3$A0$A3$A0$83$20$3C$3C$D0$0C$D1$00$30$0C$3F$FC$3C$30$3C$00$00$0C$30$0C$3C$30$3C$00$0C$00$FC$3F$3C$0C$30$FF$F0$0F$FF$FA$AA$AA$55$A3$AC$AF$AF$AA$0A$AA$55$FF$D2$BF$B0$00$D1$FF$F0$D0$00$FF$FF$F0$D3$00$D1$FF$AB$A0$00$00$D0$FF$F0$D1$00$FF$F0$DF$00$13$16$15$00$13$16$15$04$14$1C$12$D9$00$01$02$02$03$02$03$01$02$03$01$02$02$01$02$02$03$01$03$01$02$01$D0,
da.b.=""$02$0C$0D$0E$00$0C$0F$0E$00$10$11$1B$05$0C$0F$0E$00$0C$0F$0E$00$1D$1E$1F$00$00$B1$D0$00$17$00$00$D0$04$05$D5$00$06$07$08$05$D5$00$09$0A$0B$DA$00$01$02$02$03$00$01$03$01$04$01$02$02$D5$00$20$21$23$D6$00$D0$04$05$D1$00$38$7C$60$20$00$30$D0$18$00$30$D0$20$DE$00$1C$3E$30$10$00$18$08$08$18$18$1C$3C$20$DD$00$1C$3E$30$10$00$18$0C$1C$1C$18$1C$3C$76$06$DE$00$1C$3E$30$10$00$18$08$08$04$10$1C$1C$18$08$DC$00$1C$3E$30$10$00$18$18$10$10$18$3C$36$74$20$DD$00$18$3C$24$20$00$30$60$70$70$60$70$38$38$10$DF$00$D0$00$0E$1F$18$08$30$7C$F0$F0$78$10$DF$00$0E$1F$18$08$30$7C$F0$F0$E0$E0$60$DE$00$1C$38$30$18$00$0C$06$06$0E$0C$0C$06$06$04$DF$00$1C$38$30$18$1C$04$04$38$30$38$1C$DD$00$38$70$60$30$00$18$2C$20$3C$38$D0$18$08$DD$00$30$70$60$30$00$00$0C$D0$1C$18$18,
da.b.=""$38$30$DC$00$06$1F$33$73$4A$E0$F0$E0$E0$60$DE$00$06$1F$33$73$7A$F0$70$20$80$40$DF$00$D6$00$06$0F$0C$04$1E$32$00$3C$70$70$30$DD$00$18$3C$24$20$00$30$60$70$30$3C$3E$76$60$20$DF$00$D6$00$60$F1$3B$73$DC$00$38$7C$70$38$30$00$D0$20$30$D1$00$30$38$DC$00$1C$3E$38$1C$18$00$14$14$D0$20$02$06$64$70$DB$00$1C$3E$38$1C$18$00$31$43$80$80$00$00$80$C0$86$07$DC$00$1C$3E$38$1C$18$00$10$10$18$0C$00$02$06$10$1C$DB$00$1C$3E$38$1C$18$00$00$2A$4E$D1$00$C6$C7$60$DB$00$18$3D$3F$3B$36$0C$18$D3$00$08$0C$06$DF$00$00$0E$1F$1C$0E$0C$00$0C$0C$06$23$3B$DE$00$0E$1F$1C$0E$0C$00$0C$0C$D0$04$60$70$DC$00$1C$3C$3E$1C$0C$00$18$18$30$30$20$00$00$08$0E$DE$00$1C$3C$3E$1C$C0$78$18$D1$00$18$0C$DB$00$38$78$7C$38$18$01$13$1E$D2$00$10$18$0C$D8$00$0C$0C$04$3C$7C$7C$38$18$18$10$D3,
da.b.=""$00$40$60$20$DA$00$06$D0$0F$32$18$0C$D0$00$60$70$DC$00$06$D0$0F$02$08$8C$C4$76$3A$DF$00$D6$00$06$0F$0E$07$00$0C$FC$C0$D0$00$30$38$DB$00$18$3C$3D$3B$36$0C$18$D2$00$06$C7$C0$80$DF$00$D2$00$30$18$8A$0F$87$8F$B8$D7$00
i=&q+1:m.i+245,i+244,247:m.i+493,i+491,247:m.i+741,i+738,71:f._c=0t.1459:i.h:de.h:el.:k=p.i:i.k>207a.k<224:h=k-206:inci:k=p.i:e.:inci:e.:i.k=35t.k=34:_f(_c)=k:n.

PROC s
GRAPHICS 29 ' 13+16
_scr = DPEEK 88-20

' Hide screen for faster startup
poke 559,0


' Uncomment for DEBUG write
' Use DLI to point to custom character set (72 = $4800/256) after the first line
' And hide player above and below the playfield
data _p2c()B.=0,14,0:data _p3c()B.=0,24,0
dlis._=72i.$d409,_p2c i.$D014,_p3c i.$D015:dl._

i=dpeek 560
poke i,0      ' Move entire screen up 8 lines to center it
POKE i+3, peek(i + 3) +128 +2' Set DLI to set custom charset and hide PMG
POKE i+6, $85  ' Set DLI on next line to show PMG
poke i+15,$85  ' Final DLI at bottom of screen to again hide PMG

' Create flipped PMG sprite
_SPRITES=17
'_SPRITE*60 = 1020
f.i=&_f+440to&_f+440+1020:h=p.i:i.h t.p.i+1020,h&1*128+h&128/128+h&2*32+h&64/32+h&4*8+h&32/8+h&8*2+h&16/2:n.

_charset=$4800

' Add sprite characters
move &_f,_charset+8,8*34

' Duplicate chars with only bottom byte for top row
for i=1 to 35:-move _charset+i*8+7,_charset+(i+80)*8+7,1:next

' Copy torch to other location for animation
move $4800+24*8,$4800+49*8,8

pmg.2
mset pm.2,256,0

poke 704,0'$48

' Set priority,overlap mode for 3 color pmg, missles own color
P.623,56

' Player & Playfield Colors.
'm.&""$00$00$0e$18$0a$86$84$28$00,703,9
m.&""$0a$86$84$28$00,707,6
'         stand fall crouch  walk   start jump up      JU arms JU hang  climb      Crouch up    Died    Jump Horizontal........  End 
'             0    2    4 DL   6                 15            21    23    25          29           35    37       40          45   47
data _frame()=1,0, 1,5, 1,6, 8,1,2,1,0,3,4,3,0, 5,8,9,9,8,10, 1,11, 1,11, 3,12,12,13, 5,6,6,6,7,7, 1,16, 2,4,4, 4,15,15,15,4, 1,5, 2,6,7
_playerFrame=0
_frameIndex=1

_subFrame=1
_xDelta=0
_prevXDelta=0
_canMove=1
_direction=1
_col=-1
_mapW=92

'DA._fall()B.=""$01$00$00$00$01$00$01$00$01$00$00$00$00$00

' * Is not considered a floor
'*0=Space,
' 1=! pillar      2=" 
' 3=# Wall            
'*4=$ Right wall end no floor  
' 5=% Left Wall end w/ floor
'*6=& Left wall end no floor           
' 7=' torch   
'*8=( Right floor end  9=) Left floor end (with wall)
' 10=* 
' 11=+ Right wall end w/ floor
' 12=, Left floor end (nothing below)
' 13=- Floor
DA._qq()B.="-------------------------------------------------------------------------------------------",
DA.B.     ="##& (!--'-!)$##################&  (----!!---'-'-!!-'-'---,(-)  (----+######################",
DA.B.     ="%!, $######%!)$#########& (!'!!-''!--+#################%!,$#%''!)$#########################",
DA.B.     ="%!, $########%!--'--!-'!--+####%!-!--+##############%'--!-+#####%!)(-+$$$$$$$$$$$$$$$$$$$$$", 
DA.B.     ="%!, (!--------) (!--)           (-!--!--)     (------)(-!--!) $###& $###########%,       $#",
DA.B.     ="%!) (!-''!!--+& $###%'-'-------'!-!')$##%''-,(!--+###&$#####%'!-'!--!-!---'-'--!!--'--'--+#",
DA.B.     ="##%---!,$#####%)$########&$######%!--!-+--!) $#######%-+###################################",
DA.B.     ="##& (-!-!)$####&$########&$######%!-') $###& $#############################################",
DA.B.     ="##& $####%!!''!-!--'!!-'!)  $######%!) $###&  $############################################",
DA.B.     ="##%-+####################%--+########%-!!-!---+############################################"
_room=&_qq+60'_mapW*3

' Character position
_x=$4a4a:_y=52
'_x=$5151:_y=28:_direction=-1
'_x=$3a3a:_y=52
'_x=$8a8a:_y=52+24

_row=(_y-4)/24*_mapW

' Poke k=k-32, and maybe make fall throughable +20 can remove after encoding the entire level
for i=0 to _mapW*10
h=peek(&_qq+i)-32
poke &_qq+i, h'+20*(h=0 or h=4 or h=8)
n.
  
 @r
endproc

' Draw current room
proc r
  for i=0 to 39
    k = peek(_room+1+(i mod 10) + (i/10)*_mapW)
    
    h=&_f+272+k*12
    j=_scr+i*4+(i/10)*80-40

    if i>9
      for k=0 to 8 step 4
        move h+k,j+10*k,4
      n.
    else
      for k=8to11:p.j+72+k,p.(h+k)+80:n.
    e.
    
  next i

  ' Clear mask
  _lastMask=-1
  dPOKE $D000, 0

  ' Stop attract and Show screen
  poke 77,0:poke 559,46

endproc

' Animate player
proc a
' %_f 416+(SPRITES*60)*(_direction<0) +30*_frame(_frameIndex)
i=&_f+440+1020*(_direction<0)+30*_frame(_frameIndex)

h=i+510 ' _SPRITES*30
pause 
move i, pm.2+_y,30
move h, pm.3+_y,30
dPOKE $D002 , _x
endproc

@s

do
t=time:for _frame=0 to 29

'pos.4,0:?#6,_x&255;"x";_y;" ";_col;" ";_row;" "
@a
'pos.12,0:?#6,_y
' Move player left/right
if _canMove
  i=p.632:_xDelta=(n.i&8)-n.i&4

  ' Handle jumping straight up
  if not i&1
    i=_row-_mapW+(_x&255-20-6)/16
    h=peek(_room+_row+_col+_direction*2)
    
    
    ' Jump in direction of movement if there is space
    if  _xDelta and (h<3 or h>6) and h<>11
        _oldRow=_row+_room
        _playerFrame=37
        _yDelta=-1  
        _jumping=1
    else
      ' Jump straight up
      h=peek(_room+i)
      ' Can climb at end of jump
      if h*_direction=-9 or h*_direction=-12 or h*_direction=8
        _canClimb=1
        _x=((i mod _mapW+1)*16+20)*257
      e.
      if _canClimb or not _xDelta
        _xDelta=0
        _prevXDelta=0
        _playerFrame=15
      e.
    e.
     
    if _playerFrame>14
      _canMove=0
      _subFrame=1
      _frameIndex=_playerFrame+1
      _prevXDelta=_xdelta
    e.
  e.
e.

' Collison/trigger check when crossing into a new column
if _xDelta
  'Check if crossed into adjacent room
  if _x&255>201 or _x&255<47
    ' Move to room below
    _room=_room+10*_direction
  
    ' Hide screen to draw new room
    poke 559,0

    ' Clear and redraw player in new location
    mset pm.2,256,0:_x=_x-(41120-257*4)*_direction:@a

    ' Draw new room
    @r
  endif

  k=(_x&255-20+_xDelta)/16
  
  if k<>_col 
    i=(_y-4)/24*_mapW+k
    h=peek(_room+i)
    'pos.10,0:?#6,chr$(h); " ";h;" "
   
    if not _jumping and (h=5 or h=3)
       _xDelta=0
    else       
      _col=k
      j=_row

      ' Check if falling off edge
      if _canMove
        if h=8 or peek(_room+i-1)=9 or peek(_room+i-1)=12
          _yDelta=2
          _oldRow=_row+_room
          _x=_x+_xDelta*771
          mset &_xdelta,6,0 '_xDelta=0:_prevXDelta=0:_canMove=0
          _playerFrame=2:_frameIndex=3

          ' Update temp vars to check for mask directly where falling
          i=i+_mapW
          j=j+_mapW
          h=peek(_room+i)
        e.
      e.
      
      if k>10 or (h<>1 and h<>11 and h<>4) :dec k:dec i: h=peek(_room+i):e.
      if h=1 or h=11 or h=4
        if _lastMask<>k
          j=j/_mapW*24+4
          _lastMask=k
          _height=24
          if _yDelta=2
            while h=1 or h=11 or h=4
            _height=_height+20
            i=i+_mapW:h=peek(_room+i)
            wend
            _height=_height-20
            if j+_height>128 then _height=128-j
          e.
          pause
          dPOKE $D000 , k*16+36
          mset pm.0,128,0
          mset pm.0+j,_height,252
        
        e.
      e.
    e.
  e.
  _x=_x+_xDelta*257
  

endif

if _yDelta 
  _y=_y+_yDelta
  ' Check if fell to room below
  if _y>88

    ' Move to room below
    _room=_room+_mapW*3
  
    ' Hide screen to draw new room
    poke 559,0

    ' Clear and redraw player in new location
    mset pm.2,256,0:_y=_y-24*3:@a

    ' Draw new room
    @r
  e.

  i=(_y-4)/24*_mapW
  if i<>_row 
  'get k
    _row=i
    
    i=i+_col
    '_col=-1
    _lastMask=-1
    h=peek(_room+i)
    'pos.3,0:?#6,q$[_room-&q$+1+i,1]; " ";h;" ";_y;" ";_col;" ";_row;" ";_room-&q$;" " :get kk
    if _yDelta>0
      ' Check if fell to ground
      if _playerFrame=23 or (h>0 and h<>4 and h<>6 and h<>8) 'or h=1 or h=9 or h=7 or h=13 'h<>9 and 
        _yDelta=0
        ' If falling ,crouch up first
        if _playerFrame=2
          'pos.0,0:?#6,"fell ";_room+_row;" ";_oldRow;" "; (_room+_row-_oldRow)/_mapW;" ":get kk
          
          _playerFrame=29
          ' Check if fell to death
          if _room+_row-_oldRow>_mapW*2 : _playerFrame=35:dpoke 53258,257: endif
          _frameIndex=_playerFrame+1  
        elif _playerFrame=45
          _playerFrame=47
          _frameIndex=_playerFrame+1  
        else
          _prevXDelta=9
          _canMove=1
        endif
      endif
    endif
  endif
endif

' Detect when player changes animation state 
if _xDelta<>_prevXDelta
  _prevXDelta=_xDelta
  _playerFrame=6*abs _xdelta
  _frameIndex=_playerFrame+1
  '_subFrame=1
  ' Keep tack of direction player is facing
  if _xDelta t._direction=_xDelta
e.

dec _subFrame 
if n._subFrame
  _subFrame=4

  ' Player animation
  inc _frameIndex
  if_frameIndex>_playerFrame+_frame(_playerFrame)

    ' Special case logic at end of animation

    ' Initated jump, now jump straight up
    if _playerFrame=15 
        _playerFrame=21
        _yDelta=-1
      
    ' Pause in air a few frames
    elif _playerFrame=21
        _ydelta=0
        _playerFrame=23
    ' End of pause in air, now fall back down or initiate climb
    elif _playerFrame=23
      if _canClimb
        if not p.632&1
          _playerFrame=25
          _canClimb=0
          _y = _y- 10  
          ' Check if fell to room below
          if _y<20
            ' Move to room above
            _room=_room-_mapW*3
          
            ' Hide screen to draw new room
            poke 559,0

            ' Clear and redraw player in new location
            mset pm.2,256,0:_y=_y+24*3:@a
            _row=(_y-4)/24*_mapW
            ' Draw new room
            @r
          e. 
        elif peek 644
          _yDelta=1
        e.
      else
        _yDelta=1
      e.
    ' Shift from climb to crouch up
    elif _playerFrame=25
      _playerFrame=29
      _y = _y- 10
      _x =_x + 771*_direction
    ' End of crouch up
    elif _playerFrame=29 or _playerFrame=47
      'pos.10,0:?#6,_playerFrame
        'get k
      
      _playerFrame=0
      _canMove=1
    elif _playerFrame=37
      _yDelta=0
      _playerFrame=40
    elif _playerFrame=40
      _playerFrame=45
      _yDelta=1
    elif _playerFrame=45
      if _xdelta
        _xDelta=0
        _row=-1
        _prevXDelta=0
        _xDelta=0
        _jumping=0
      else
        _playerFrame=2
      endif
      
    'elif _playerFrame=45

     ' get k
    e.
    
    _frameIndex=_playerFrame+1
  endif

  ' Torch animation
  _torch = _torch mod 3 + 1
  move _charset+(23 + _torch)*8,_charset+49*8,8
e.
next:t=time-t:pos.0,0:?#6,(1800-300*(PEEK(53268)=1))/t;" ":t=time
loop

