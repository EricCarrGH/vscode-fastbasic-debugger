D=10
A=20
jj=0:hh=2:l=2

Dim lastResult$, round, pot, activePlayer, prompt$, activeSecondsRemaining, validMoveCode$(5), validMove$(5)
dim player_name$(7), player_status(7), player_bet(7), player_move$(7), player_purse(7), player_hand$(7), player_prevHand$(7)

' State related variables
dim validMoveCount, playerCount, currentCard, xOffset, requestedMove$, previousPot, playerJustMoved, prevPlayerCount


' The screen buffer is large to accomodate the playfield and character at atari required byte aligned locations.

' ScreenBuffer layout:
' N bytes    - empty space to set the Playfield location at a 4096 byte increment
' 2048 bytes - Playfield (1040 or 40*26 effectively used) 
' 1024 bytes - Character fonts
' 22 bytes   - Display List 
DIM responseBuffer(4096) BYTE, screenBuffer(8192) BYTE, move_loc(7), move_bits(7) BYTE

' Other varibles
'DIM Screen,__print_inverse, move_color, __print_reverse, noAnim, cursorY, cursorX

' DLI Colors 
'data background_color()B.=$B4,0
'data text_color()B.=$0E,0

' Player hand and bet locations onscreen
'DIM playerX(7), playerY(7), playerDir(7), playerBetX(7), playerBetY(7)

' DATA playerXMaster() = 17,1, 1, 1, 15, 37,37, 37
' DATA playerYMaster() = 20, 19, 11, 3, 2,3,11,19
' DATA playerDirMaster() = 1,1,1,1,1,-1,-1,-1

' DATA playerBetXMaster() = 1,10,10,10,3,-9,-9,-9
' DATA playerBetYMaster() = -3, -2, 1,4,5,4,1,-2

PROC DF
hello$=""
hello$="asdf"
ENDPROC

A=1
? "1 A = "; A
? "2 A = "; A
? "3 A = "; A
@DF
? "Address of A"; &A

a=23543
@DF
loc = &a


value$=hello$
? HELLO$


dim ID(3), player$(3)

for i=0 to 3
  id(i) = 1000+i
  player$(i) = "PLAYER "
  player$(i) =+str$(i)
  @DF
next i

for i=0 to 3
  ? "Hello "; player$(i); " with ID "; id(i)
next i
j=0
proc StopHere j
inc j
ENDPROC
h%=12.34

dim e,f%(10)
f%(0)=123.45678
f%(1)=12.345678
f%(2)=1.2345678
f%(3)=.12345678
f%(4)=.01234567
f%(5)=.00123456
f%(6)=.00012345
f%(7)=.00001234
f%(8)=.00000123
f%(9)=.1234567891
f%(10)=.12345678912
? &e
'do
gr.0:
? h%
for i=0 to 10:? f%(i):next i

inc j
'loop