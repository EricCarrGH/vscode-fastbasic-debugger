'' Work in Progress 5 Card Stud Client
'' Currently works with the GO Mock server
'' Does not yet have complete game loop to handle joining/leaving servers/tables

' There is still an outstanding visual card drawing bug when joining an existing server

' FujiNet AppKey settings. These should not be changed
AK_CREATOR_ID = 1 ' FUJINET
AK_APP_ID  = 1 ' Lobby Enabled Game
AK_KEY_USERNAME = 0
AK_KEY_SERVER = 1 ' 5 Card Stud registered as game type 1

DATA NAppKeyBlock()=0,0,0

myName$ = "" 
serverEndpoint$=""
query$=""
@NReadAppKey AK_CREATOR_ID, AK_APP_ID, AK_KEY_SERVER, &serverEndpoint$

IF serverEndpoint$<>""
  for i=1 to len(serverEndpoint$)
    if serverEndpoint$[i,1]="?"
      query$=serverEndpoint$[i]
      serverEndpoint$=serverEndpoint$[1,i-1]
      exit
    endif
  next
ELSE
  ' For local testing
  serverEndpoint$="https://5card.carr-designs.com/"
  query$="?table=eric&count=3"
ENDIF


' Silence the loud SIO noise
POKE 65,0


DIM responseBuffer(1023) BYTE

' Align screenBuffer at 4096 boundary (and charBuffer at 1024 boundary afterward)
i = (&responseBuffer+1024) mod 4096
if i>0 then dim filler(4095-i) BYTE

dim screenBuffer(2047) BYTE, charBuffer(1023), move_loc(7), move_bits(7) BYTE


' Game state variables (read from server)
Dim lastResult$, round, pot, activePlayer, prompt$, activeSecondsRemaining, validMoveCode$(5), validMove$(5)
dim player_name$(7), player_status(7), player_bet(7), player_move$(7), player_purse(7), player_hand$(7), player_prevHand$(7)

' State related variables
dim validMoveCount, playerCount, currentCard, xOffset, requestedMove$, previousPot, playerJustMoved, prevPlayerCount



' Other varibles
DIM Screen,__print_inverse, move_color, __print_reverse, noAnim, cursorY, cursorX

' DLI Colors 
data background_color()B.=$B4,0
data text_color()B.=$0E,0

' Player hand and bet locations onscreen
DIM playerX(7), playerY(7), playerDir(7), playerBetX(7), playerBetY(7)

DATA playerXMaster() = 17,1, 1, 1, 15, 37,37, 37
DATA playerYMaster() = 20, 19, 11, 3, 2,3,11,19
DATA playerDirMaster() = 1,1,1,1,1,-1,-1,-1

DATA playerBetXMaster() = 1,10,10,10,3,-9,-9,-9
DATA playerBetYMaster() = -3, -2, 1,4,5,4,1,-2

' Simple hard coded arrangment of players around the table based on player count.
' These refer to index positions in the Master arrays above
' Downside is new players will cause existing player positions to move.
'
'                         2                3                4  
DATA playerCountIndex() = 0,4,0,0,0,0,0,0, 0,2,6,0,0,0,0,0, 0,2,4,6,0,0,0,0, 
'       5                6                 7                8
DATA  = 0,2,3,5,6,0,0,0, 0,2,3,4,5,6,0,0,  0,2,3,4,5,6,7,0, 0,1,2,3,4,5,6,7


' Possible coloring of chips - TODO Later?
' Bringin, low, high, high+  (2, 5, 10, 20)
' DATA chipDenom() = $70,  $F0, $6F, $EF

' Set this to a high number to 
prevRound=99

' ============================================================================
' (DEBUG) Timer Procs: Start Timer (ST) / EnD Timer (ET)
PROC ST: t=time+1 :repeat:until time=t:endproc
PROC ST2: t=time:endproc
PROC ET text: ? (time-t)*16;" ms", $(text), fre() :endproc


' ============================================================================
' (Utility Functions) Convert string to upper case, replace character in string
PROC ToUpper text
  for __i=text+1 to text + peek(text)
    if peek(__i) >$60 and peek(__i)<$7B then poke __i, peek(__i)-32
  next
ENDPROC

PROC StringReplace text _from _to 
  if peek(text) = 0 then exit
  FOR __i=text+1 to text+peek(text)
    if peek(__i) = _from then poke __i, _to
  NEXT
ENDPROC

' ============================================================================
' Print #6 Replacementsn
' Since there is a custom screen location for 26 rows, print #6 will not work, I use POKE routines to PRINT.
' These were written over time as needed, so not as organized or optimized as they could be.

PROC PrintUpper text
  temp$=$(text)
  @ToUpper &temp$
  @Print &temp$
ENDPROC

PROC PrintAt _col _row text
  @Pos _col, _row
  @Print text
ENDPROC

PROC POS _col _row
  __loc = screen + 40*_row +_col
ENDPROC

' Inverse is the analog to COLOR(128)
PROC PrintInv text
  __print_inverse=128
  @Print text
  __print_inverse=0
ENDPROC

' Reverse prints right aligned, starting at the current location
PROC PrintReverse
  __print_reverse = 1
ENDPROC

PROC PrintVal text
  @Print &str$(text)
ENDPROC

' Prints text, followed by space up the specified character length.
' Useful for printing "100" in one moment, then "1  " next, without building the string manually
PROC PrintValSpace text __len
  @PrintSpace &str$(text), __len
ENDPROC

' Prints space for the rest of this line - used for bottom status bar
PROC PrintSpaceRest
  __charsLeft = 40 - (__loc-screen-40*_row)
  mset __loc, __charsLeft, 0
ENDPROC

PROC PrintSpace text __len
  if __print_reverse 
    temp$=""
    while peek(text)+len(temp$)<__len: temp$ =+" ": wend
    temp$ =+ $(text)    
  else 
    temp$ = $(text)
    while len(temp$)<__len: temp$ =+" ": wend
  endif

  @print &temp$
ENDPROC

' ============================================================================
' Core Printing routine. Converts frmo ATASCII to INTERNAL, handling inverted, alphanumeric and a few other supported characters
PROC Print text
  if __print_reverse then __loc = __loc - peek(text)+1
  ' Go through each character and convert from ATASCII to INTERNAL, then poke to screen to draw it
  FOR __i=text+1 to text+peek(text)
    _code = peek(__i)
    
    if _code<32
      _code= _code + 64
    elif _code< 95
      _code= _code - 32
      if _code = 12 then _code=116 ' Handle comma
      if _code = 13 then _code=0  ' Translate hyphen to space
    elif _code<128
    elif _code<160
      _code= _code + 64
    elif _code<223
      _code= _code - 32
    endif

    poke __loc,_code+__print_inverse
    __loc = __loc + 1
  next

  ' Reset print reverse
  __print_reverse = 0
  
ENDPROC

' Print a byte directly (INTERNAL, not ATASCII)
PROC PrintByte _byte
  poke __loc,_byte
  inc __loc
ENDPROC


' ============================================================================
' (N AppKey Helpers) Call NRead/WriteAppKey to read or write app key

PROC __NOpenAppKey __N_creator __N_app __N_key __N_mode
  dpoke &NAppKeyBlock, __N_creator
  poke &NAppKeyBlock + 2, __N_app
  poke &NAppKeyBlock + 3, __N_key
  poke &NAppKeyBlock + 4, __N_mode
  SIO $70, 1, $DC, $80, &NAppKeyBlock, $09, 6, 0,0
ENDPROC

PROC NWriteAppKey __N_creator __N_app __N_key __N_string
  @__NOpenAppKey __N_creator, __N_app, __N_key, 1
  SIO $70, 1, $DE, $80, __N_string+1, $09, 64, peek(__N_string), 0
ENDPROC

PROC NReadAppKey __N_creator __N_app __N_key __N_string
  @__NOpenAppKey __N_creator, __N_app, __N_key, 0
  SIO $70, 1, $DD, $40, __N_string, $01, 66,0, 0
  MOVE __N_string+2, __N_string+1,64
  ' /\ MOVE - The first two bytes are the LO/HI length of the result. Since only the
  ' first byte is meaningful (length<=64), and since FastBasic string
  ' length is one byte, we just shift the entire string left 1 byte to
  ' overwrite the unused HI byte and instantly make it a string!
ENDPROC

' ============================================================================
' (N Helper) Gets the entire response from the specified unit into the provided buffer index for NInput to read from.
' WARNING! No check is made for buffer length. A more complete implimentation would handle that.
PROC NInputInit __NI_unit __NI_index
  __NI_bufferEnd = __NI_index + DPEEK($02EA)
  NGET __NI_unit, __NI_index, __NI_bufferEnd - __NI_index
ENDPROC

' ============================================================================
' (N Helper) Reads a line of text into the specified string - Similar to Atari BASIC: INPUT #N, MyString$
PROC NInput __NI_stringPointer

  ' Start the indexStop at the current index position
  __NI_indexStop = __NI_index
  
  ' Seek the end of this line (or buffer)
  while peek(__NI_indexStop) <> $9B and __NI_indexStop < __NI_bufferEnd
    inc __NI_indexStop
  wend

  ' Calculate the length of this result
  __NI_resultLen = __NI_indexStop - __NI_index
  
  ' Update the length in the output string 
  poke __NI_stringPointer, __NI_resultLen

  ' If we successfully read a value, copy from the buffer to the string that was passed in and increment the index
  if __NI_indexStop < __NI_bufferEnd
    move __NI_index, __NI_stringPointer+1, __NI_resultLen

    ' Move the buffer index for the next input
    __NI_index = __NI_indexStop + 1
  endif
ENDPROC

' ============================================================================
' Not "Game ready" yet - Need to make this more user friendly
PROC SetError text
    temp$=$(text)
    'NSTATUS 8
    @POS 0,25
    @Print &"ERROR "
    @printval PEEK(749)
    @print &" : "
    @Print &temp$
    '@ShowScreen
    GET K
ENDPROC


' ============================================================================
' Call the server api endpoint
PROC ApiCall apiPath

  ' Set up URL
  temp$ = "N:"
  temp$ =+ serverEndpoint$
  temp$ =+ $(apiPath)
  temp$ =+ query$
  temp$ =+ ""$9B

  ' Open connection
  NOPEN 8, 12, 0, temp$
  
  ' If not successful, then exit.
  IF SErr()<>1 
    @SetError &"COULD NOT CONNECT TO SERVER":EXIT
  ENDIF

  ' Change channel mode to JSON (1)
  SIO $71, 8, $FC, $00, 0, $1F, 0, 12, 1

  ' Ask FujiNet to parse JSON
  SIO $71, 8, $50, $00, 0, $1f, 0, 12, 0

  ' If successfully parsed JSON, update state
  IF SErr()=1 
    @UpdateState
  ELSE
    @SetError &"COULD NOT PARSE JSON":EXIT
  ENDIF

  ' Close connection
 NCLOSE 8
ENDPROC


' ============================================================================
' Calls the server, picking the appropriate path
Proc CallServer
  if len(requestedMove$)>0 
    path$ = "move/"
    path$ =+ requestedMove$
    requestedMove$=""
  else
    path$ = "state"
  endif

  ' Call the server (updates state on every response)
  @ApiCall &path$
endproc

' ============================================================================
' Updates the state from the current Api call
PROC UpdateState
  
 ' Query Json response
 SIO $71, 8, $51, $80, &"N:"$9B+1, $1f, 256, 12, 0

 ' Check for query success
 NSTATUS 8
 IF PEEK($02ED) > 128
  @SetError &"COULD NOT QUERY JSON"
  EXIT
 ENDIF

' Initialize reading the api response
 @NInputInit 8, &responseBuffer

 ' Load state by looping through result and extracting each string at each EOL character
 isKey=1:inArray=0:playerCount=0:validMoveCount=0
 line$=""
 parent$=""
 do
  ' Get the next line of text from the api response
  @NInput &line$

  'p$=line$:p$=+"  ":pos. 1,5:@PrintUpper &p$:get k

  ' The response is mostly alternating lines of key and value, with the exception of arrays,
  ' which are handled as a special case further below.  
  if isKey

    ' An empty key means we reached the end of the response
    if len(line$) = 0 then exit

    key$= line$
    
    ' Special case - "players" and "validMoves" keys are arrays of key/value pairs
    if key$="players" or key$="validMoves" or key$="NULL"

      ' If the key is a NULL object, we effectively break out of the array by setting parent to empty
      if key$="NULL" then key$=""

      parent$=key$

      ' Reset isKey since the next line will be a key
      isKey = 0
    endif
  else
    value$ = line$
   ' print parent$;":";key$;"=";value$:get k
    ' Set our state variables based on the key
    if   key$="lastResult"    : lastResult$ = value$
    elif key$="round"         : round = val(value$)
    elif key$="pot"           : pot = val(value$) 
    elif key$="activePlayer"  : activePlayer = val(value$)
    elif key$="prompt"        : prompt$ = value$
    elif key$="activeSecondsRemaining" : activeSecondsRemaining = val(value$)
    elif parent$="validMoves" 
      if key$="move"
        @ToUpper &value$ 
         validMoveCode$(validMoveCount) = value$
      elif key$="name" 
        @ToUpper &value$ 
        validMove$(validMoveCount) = value$
        inc validMoveCount
      else :parent$="": endif
    elif parent$="players"
      if key$="name" 
        @ToUpper &value$
        if len(value$)>8 then value$=value$[1,8]
        player_name$(playerCount) = value$
      elif key$="status"       : player_status(playerCount) = val(value$)
      elif key$="bet"           : player_bet(playerCount) = val(value$)
      elif key$="move"          : player_move$(playerCount) = value$
      elif key$="purse"         : player_purse(playerCount) = val(value$)
      elif key$="hand"          : player_hand$(playerCount) = value$: inc playerCount 
      else :parent$="": endif
    endif
  endif

  ' Toggle if we are reading a key or a value
  isKey = not isKey
 loop
ENDPROC

' ============================================================================
' Draws the specified card (e.g. "3C" for 3 of clubs) on the screen
' It looks at the existing playfield to render this card overlapping
' an existing card in a few supported cases.

PROC DrawCard text _col _row
  loc = screen + 40* _row +_col
  topBottomOffset=0
  
  ' Get character index based on value of card
  val = peek(text+1)

  if  val=$3F : topBottomOffset = 4: val=$3C ' Special case - back of card
  elif val=$54 : val = 10         ' 10
  elif val<$40 : val = val - $30  ' 2 to 9
  elif val=$4A : val = 12         ' Jack
  elif val=$51 : val = 13         ' Queen
  elif val=$4B : val = 14         ' King
  elif val=$41 : val = 15         ' Ace
  endif

   ' Get suit character index
   suit = peek(text+2)
   if   suit=$48 : suit = $C0: val=val+128 ' Hearts
   elif suit=$44 : suit = $C2: val=val+128 ' Diamonds
   elif suit=$43 : suit = $44 ' Clubs
   elif suit=$53 : suit = $46 ' Spade
   endif

  ' Check if a card exists underneath to the right. This will adjust some chars being drawn
  rightUnder =  peek(loc+42)>0

  if rightUnder 
    topBottomOffset=-4
    ' Draw left top and bottom corners
    poke loc-1, 75
    poke loc+159, 76
    suit=suit+32
  endif

  ' Draw Top of card
  dpoke loc, 256*($52+topBottomOffset )+ ($51+topBottomOffset)
  

  if val<>$3C

    ' Draw Value of card followed by blank space or second "10" character if  value is 10 (or 128+10 for red suits)
    ' If there is a card underneath to the right, adjust char
    isTen = val=10 or val=138
    val = val+(1+val*isTen + rightUnder*(61-9*isTen))*256 
    
    dpoke loc+40, val

    ' Draw Middle white
    dpoke loc+80, $0101 + (rightUnder*$3D*256)

    ' Draw Suit of card
    dpoke loc+120, suit*257+256
  else ' Back of card
    dpoke loc+40,$BC3C
    dpoke loc+80,$3CBC
    dpoke loc+120,$BC3C
  endif

  ' Draw Edges of card
  for locSide=loc+39 to loc+39+80 step 40
    
    ' Left edge 
    val = peek(locSide)
      
    ' Check if overlaying on top of existing card
    if   val=$3C or val=$BC : inc val ' Card back
    elif val=1  : val= 62 ' White space
    elif (val>64 and val<72) or (val>191 and val<201) : val=val+32: poke locSide-1, peek(locSide-1)+32 ' Suit
    elif val=11 or val=139 : val=val+52 ' 10 
    elif rightUnder : val=72
    else : val=73 ' Default left edge
    endif

    poke locSide, val
    
    ' Right edge - draw only if empty
    if not rightUnder then poke locSide+3, 74
    
  next locSide

  ' Draw Bottom of card
  dpoke loc+40*4, 256*($54+topBottomOffset )+ ($53+topBottomOffset)
ENDPROC

PROC DEBUG_TEST_DRAWCARD
  @ResetScreen
  @ShowScreen
  SUITTest$="HDCS"


  x=1:y=1

  @DrawCard &"??", x,y
  
  x=x+1
  @DrawCard &"0D", x,y
  
  x=x+2
  @DrawCard &"0S", x,y

  x=x+2
  @DrawCard &"3H", x,y


  x=x+10
  @DrawCard &"??", x,y
  
  x=x-1
  @DrawCard &"0D", x,y
  
  x=x-2
  @DrawCard &"0S", x,y
  
  x=x+10


  for j=2 to 3
    for i=2 to 10
      card$=str$(i mod 10)
      card$=+ suittest$[j,1]
      @DrawCard &card$, x,y
      x=x+4:if x>35 :x=1:y=y+5: endif
    next i

    card$="J": card$=+ suittest$[j,1]:@DrawCard &card$, x,y
    x=x+4:if x>35 :x=1:y=y+5:endif
    card$="Q":card$=+ suittest$[j,1]:@DrawCard &card$, x,y
    x=x+4:if x>35 :x=1:y=y+5:endif
    card$="K":card$=+ suittest$[j,1]:@DrawCard &card$, x,y
    x=x+4:if x>35 :x=1:y=y+5:endif
    card$="A":card$=+ suittest$[j,1]:@DrawCard &card$, x,y
    x=x+4:if x>35 :x=1:y=y+5:endif
  next j

   get k
ENDPROC


' ============================================================================
' Show initial screen to capture player's name
PROC WelcomeScreen

  @DrawCard &"AS",1,0: @DrawCard &"AH",37,0
  @DrawCard &"AD",1,20: @DrawCard &"AC",37,20
  
  @POS 4,1:FOR I=1 TO 8:@Print &""$9C$99$1A$1B:NEXT
  @POS 4,22:FOR I=1 TO 8:@Print &""$9C$99$1A$1B:NEXT

  N=13
  @POS N,3: @Print &"      i"
  @POS n,4: @Print &"     ljl"
  
  @POS n,5: @Print &"FUJInjpjhNET"
  @POS n,6: @Print &"     lljh"
  @POS n,7: @Print &"      mll"
  @POS n+4,9:@Print &"5 CARD STUD"
  @ShowScreen
  pause 1
  ' Read player's name from app key
  @NReadAppKey AK_CREATOR_ID, AK_APP_ID, AK_KEY_USERNAME, &myName$
  @ToUpper(&myName$)
 
  ' Ask player for name if it is not yet populated
  if len(myName$)=0
    @POS 13,15:@Print &"ENTER YOUR NAME"

    @POS 14,17:@Print &";@@@@@@@@@@<"
    @POS 14,18:@Print &"?          "$BF
    @POS 14,19:@Print &"=":@PrintInv &"@@@@@@@@@@>"

    cursor = $76
    frame = 0

    @POS 16,18:@Print &MyName$:@PrintByte cursor
    
    ' Input box to capture player name and show blinking cursor
    ' Ensure at least 1 character name  
    do
      if key()
        get k
        if k=$9B and len(myName$)>0 then exit
        if k>96 then k=k-32
        if k=94 and len(myName$)>0
          myName$=myName$[1,len(myName$)-1]
          @POS 16,18::@Print &myName$:@PrintByte $76:@PrintByte 0
        endif
        
        if (k=32 or (k>=65 and k<=90) or (k>=48 and k<58)) and len(myName$)<8
          myName$=+chr$(k)
          @POS 16,18:@Print &MyName$:@PrintByte $76
        endif 
      endif

      pause
      inc frame
      if frame=40
        frame=0
        cursor = $76 + (cursor=$76)
        @POS 16+len(myName$),18:@PrintByte cursor
      endif
    loop


    ' Name has been captured. Save to app key and show welcome text
    @NWriteAppKey AK_CREATOR_ID, AK_APP_ID, AK_KEY_USERNAME, &myName$
  endif

  for n=15 to 19
  @POS 13,n:@Print &"                  "
  next
  @POS 16-len(myname$)/2,15:@Print &"WELCOME ":@Print &myname$
  @POS 10,19:@Print &"CONNECTING TO SERVER"
  @ShowScreen
  pause 120
ENDPROC


PROC CheckPlayerCount

  if playerCount <> prevPlayerCount

    ' Handle if player joins mid game
    if prevPlayerCount > 0 
      @pos 0,25
      IF playerCount-prevPlayerCount>1 
        @Print &"NEW PLAYERS JOIN THE TABLE"
      ELSE
        @Print &"A NEW PLAYER JOINS THE TABLE"
      ENDIF
      for j =1 to 30 step 5
        sound j,0,0,2+j/5:pause 2
        for vol=1+j/5 to 0 step -1
          sound j,0,0,vol:pause
        next
        pause 3
      next
      sound
      pause 40
      prevRound=9
      noAnim = 1
    endif

    prevPlayerCount = playerCount
    
    i=0
    for j=(playerCount-2)*8 to (playerCount-2)*8+7
      n=playerCountIndex(j)
      playerX(i) = playerXMaster(n)
      playerY(i) = playerYMaster(n)
      playerDir(i) = playerDirMaster(n)
      playerBetX(i) = playerBetXMaster(n)
      playerBetY(i) = playerBetYMaster(n)
      inc i
    next

    
  endif
endproc


' ============================================================================
' Refreshes the entire table screen from the state.
' There is a bit of checking of gamestate here to know when to draw
' new cards, show the player moves and current bet total. 
PROC UpdateScreen
   
  @CheckPlayerCount
   
  ' Clear status/move bar  
  if playerJustMoved or activePlayer = -1
    playerJustMoved = 0
    @Pos 0,25:@PrintSpaceRest
    @ClearCursor
  endif

  firstRender = round<prevRound
  prevRound=round

  ' Check if the first render of this game
  if firstRender
    
    ' Clear the screen for good measure
    @ResetScreen

    ' Reset rendering details
    xOffset=0
    currentCard=0
    prevPot = 0
    cursorY=246
    cursorX=128

    ' Pot border
    @POS 17,12:@PrintInv &";@@@@<"
    @POS 17,13:@PrintInv &"?o   ?"
    @POS 17,14:@PrintInv &"=@@@@>"

    ' Pot total
    @POS 20-1*(pot>99),13:@PrintVal pot
    
  else 
    
    if pot <> prevPot or round=5
      prevPot = pot

      ' Clear bets
      for i=0 to playerCount-1
          if round=5 or player_move$(i)=""
            @POS playerX(i)+playerBetX(i), playerY(i)+playerBetY(i)+1
            if playerDir(i)<0 then @PrintReverse
            @Print &"     "
          endif
      next

      ' Pot total
      @POS 20-1*(pot>99),13:@PrintVal pot
    endif

  endif

  ' Player names/purse
  if round<5 then @RenderNamePurse
  if noAnim then @RenderCards

  @ShowScreen

  if firstRender then @RenderCards
  
  ' Player bet/move
  if round<5
    for i=0 to playerCount-1

      ' Print bet
      if player_bet(i)>0 
        @POS playerX(i)+playerBetX(i)-(playerDir(i)<0), playerY(i)+playerBetY(i)+1
        if playerDir(i)<0 
          @PrintReverse
        else
          @PrintByte $EF
        endif

        @PrintValSpace player_bet(i), 4
        if playerDir(i)<0 then @PrintByte $EF
      endif
      
      ' Print Move
      if len(player_move$(i))>0 
        @POS playerX(i)+playerBetX(i), playerY(i)+playerBetY(i)+ (player_bet(i)=0)
        if playerDir(i)<0 then @PrintReverse    
        @PrintSpace &player_move$(i), 5
      endif

    next
  endif


  if not firstRender then @RenderCards
  
  
  if activePlayer=0
     @printat playerX(0)-5, playerY(0)+3, &"xYOU" 
  elif activePlayer>0
    dir = playerDir(activePlayer)
    wid = len(player_name$(activePlayer))
    x = playerX(activePlayer)-dir+(dir<0)
    y = playery(activePlayer)-1

    @Printat x, y, &"xy"[1+(dir<0),1]
    @MoveCursorToLocation 52+4*(x-(wid+1)*(dir<0)), 32+8*y, wid 

  endif
  

  ' Check for end of round
  if activePlayer=-1 and round<5
    @ClearCursor

    activePlayerCount = 0
    for i=0 to playerCount-1
      if player_status(i)=1 then inc activePlayerCount
    next

    ' Wait a bit unless only one player is left
    if activePlayerCount > 1 then pause 60

    ' Clear moves
    for i=0 to playerCount-1
      @POS playerX(i)+playerBetX(i), playerY(i)+playerBetY(i) + (player_bet(i)=0)
      if playerDir(i)<0 then @PrintReverse
      @Print &"     "
    next

   ' if activePlayerCount > 1 then pause 20
  endif

  if activePlayer = 0
    @WaitOnPlayerMove
  else
    @pos 0,25
     pause 60
    ' Check for end of game
    if round=5
      sound 1,200,10,8:pause 2
      sound 1,170,10,8:pause 2
      @PrintUpper &lastResult$
      sound 1,150,10,8:pause 2
      sound 1,140,10,8:pause 2:
      sound 1,135,10,8:pause 2
      sound 1,132,10,8:pause 2
      sound
      pause 60
      @RenderNamePurse
      @PrintAt 19,13, &" 0 "


      repeat: until not strig(0)
      @pos 0,25
    elif activePlayer>0
      @Print &"WAITING ON ":@PrintUpper &player_name$(activePlayer)
    endif
    
    @PrintSpaceRest
  endif

ENDPROC

PROC RenderNamePurse

  activePlayerLoc=0
  for i=0 to playerCount-1
    
    ' Print name, left or right justified based on direction
    x = playerX(i)
    if playerDir(i)<0 then x=x+1

    if i>0 
      @POS x, playerY(i)-1
      if playerDir(i)<0 then @PrintReverse
      @Print &player_name$(i)

      if playerDir(i)>0 then @POS x-1, playerY(i)-1
      if activePlayer<>i
        @PrintByte 0
      endif
    else
      if activePlayer<>0 
        @printat x-5, playerY(i)+3, &" YOU" 
      endif
    endif

    ' Print purse
    if i=0 then x=x-3
    y = playerY(i)-2+(i=0)*3
    @POS x+playerDir(i), y    
    if playerDir(i)<0 or i=0 then @PrintReverse
    @PrintValSpace player_purse(i), 5
    @POS x-(i=0)*2, y: @PrintByte $EF
 
  next
ENDPROC

PROC RenderCards  
  ' Draw next cards with sound/delay as if the dealer is dealing out one by one
  while currentCard<round+1
    if not noAnim then pause 10
    inc currentCard
    j=currentCard*2-1
    if not noAnim then pause 10
    for ii=1 to playerCount
      i = ii mod playerCount
      if len(player_hand$(i))>j 
        if not noAnim then sound 1,0,0,1
        @DrawCard &player_hand$(i)[j,2], playerX(i)+((i>0)*xOffset+(i=0)*(J-1))*playerDir(i), playerY(i)

        if not noAnim
          for vol=2 to 0 step -1
            pause :sound 1,0,0,vol
          next
          sound
        endif
        player_prevHand$(i) = player_hand$(i)
          
        ' Mask player's hidden card
        if i=0 and j=3 then @CreatePlayerSecretCardMask
        if not noAnim then pause 5
      endif
    next
    inc xOffset
    if xOffset>1 then inc xOffset
  wend
  
  
  ' Check if hand changed outside of dealing (either from folding or the end of the game reveal)
  for i=0 to playerCount-1
    if player_hand$(i) <> player_prevHand$(i)
      ' Delay a bit for end of round
      if round=5 then pause 60
      player_prevHand$(i) = player_hand$(i)
      
      ' Erase the current hand on the screen
      oldXOffset = xOffset:xOffset=0
      x = screen+playerY(i)*40+playerX(i)-1-7*(playerDir(i)<0)
      wid=11+(i=0)
      pause

      ' If the client player has is folding, hide the mask
      if i=0 then @HidePlayerSecretCardMask
      for j=0 to 199 step 40:mset x+j,wid,0:next

      ' Draw new hand on-screen
      sound 1,0,0,1:vol=4
      for j=1 to len(player_hand$(i)) step 2
        @DrawCard &player_hand$(i)[j,2], playerX(i)+((i>0)*(xOffset)+(i=0)*(J-1))*playerDir(i), playerY(i)
        inc xOffset:inc xOffset:
        sound 1,0,0,vol: if vol>0 then dec vol
      next
      pause
      sound 
      xOffset = oldXOffset
    endif
  next

  ' If this is the end of the round, hide the client's mask
  if round=5 then @HidePlayerSecretCardMask

  noAnim = 0
ENDPROC

PROC ClearCursor
  mset pm.2+cursorY,2,0
ENDPROC

PROC MoveCursorToLocation __x __y __len
 mset pm.2,256,0
  bit=128:total=0
  for j=1 to __len
    total = total + bit
    bit=bit/2
  next 

  x=__x-20
  y=__y'+3
  cursorX = __x
  cursorY = __y
  ny=y
  nx=x
  repeat
    if y<>cursorY 
      ny=y+sgn(cursorY-y)
      'if abs(cursory-ny)<=4 then NY=cursorY
    endif

    if x<>cursorX 
      delta = (cursorX-x)/4
      if delta=0 then delta = sgn(cursorX-x)
      nx=x+delta
      'if abs(cursorX-nx)<=2 then nx=cursorX 
    endif

    pause
    'mset pm.2+y,2,0
    mset pm.2+ny,2,total
    PMHPOS 2,nx
    y=ny:x=nx
  until x=cursorX and y=cursorY
endproc

PROC WaitOnPlayerMove
  ' Clear the bottom row  
  mset screen+40*25,40,0

  text_color(1) = $0

  ' Draw the moves and store the locations and player bits
  @POS 1,25
  x=0
  for i=0 to validMoveCount-1
    move_loc(i) = x
    @Print &validMove$(i)
    @Print &"  "
    x = x + len(validMove$(i))+2

    bit=128:total=0
    for j=1 to len(validMove$(i))
      total = total + bit
      bit=bit/2
    next 
    move_bits(i)=total    
  next 

 

  ' Setup move player line indicator
  move = 1
  cursorX = 52+4*move_loc(move)
  @MoveCursorToLocation cursorX, 235, len(validMove$(1))
  x=cursorX
  'cursorY=246
  'PMHPOS 2,x
  'mset pm.2+236,2,move_bits(move)

 ' Fade in moves and play ding-ding sound
  sound 0,80,10,5:vol=8
  for color = move_color-12 to move_color 
    text_color(1) = color
    pause
    vol=vol-1
    if vol=0  then vol=8
    sound 0,80,10,vol
  next

  ' Fade out ding-ding sound
  while vol>=0
    sound 0,80,10,vol:pause 2:dec vol
  wend

  ' Move selection loop
  prevJoy=0
  repeat

    pause
    if x<>cursorX 
      x=x+(cursorX-x)/2
      if abs(cursorX-x)<=1 : x=cursorX : sound : endif
      PMHPOS 2,x
      sound
    endif

    ' Read joystick
    joy = stick(0)
   
    ' Get left or right direction. Use "AND 4" and "AND 8" to so diagnal movement works as well for left/right
    joy = (not joy&8) - (not joy&4)

    ' If moved joystick left or right
    if prevJoy = 0 and joy
      
      move = move + joy

      ' Check if in bounds of move counts
      if move <0 or move >= validMoveCount 
        ' At edge. Show bump animation
        move = move - joy
        PMHPOS 2,x+joy
        sound 1,255,10,8:pause 2:sound
        PMHPOS 2,x
      else
        ' Can move
        sound 1,100,10,8
        mset pm.2+cursorY,2,move_bits(move)
        cursorX = 52+4*move_loc(move)
      endif
    endif

    ' Store joy location so we know whenever the player changes direction
    prevJoy = joy
  until not strig(0)
  
  ' Clear the other moves 
  sound 1,100,10,8
  pause
  mset screen+40*25+1, move_loc(move),0
  mset screen+40*25+1+ move_loc(move)+len(validMove$(move))+1,40,0
  requestedMove$ = validMoveCode$(move)
  text_color(1) = move_color
  
  ' todo - different sound for moves
  sound 1,80,10,8:pause 2:
  sound 1,70,10,8:pause 2:sound

  playerJustMoved = 1
  
ENDPROC


Proc HidePlayerSecretCardMask
  PMHPOS 1,0
endproc

' ===================================
' Update "player 1" to be a mask of the player's hidden card, so it can be
' displayed as darker to indicate it is hidden from other players
PROC CreatePlayerSecretCardMask
  i = screen+40*playerY(0)+playerX(0)+40
  
  ' Move the mask offscreen when creating
  @HidePlayerSecretCardMask

  for j= 0 to 23
    if j mod 8 = 0 
      val = peek(i) mod 128:  src = screen+2048+val*8: i = i + 40
    endif
    v = peek(src+j mod 8)
    poke pm.1+191+j,  (v&$C0<$C0)*$80 + (v&$30<$30)*$40 + (v&$0C<$0C)*$20 + (v&$03<$03)*$10
  next

  i = screen+40*playerY(0)+playerX(0)+41
  for j= 0 to 23
    if j mod 8 = 0 
      val = peek(i) mod 128:  src = screen+2048+val*8: i = i + 40
    endif
    v = peek(src+j mod 8)
    poke pm.1+191+j, peek(pm.1+191+j) + (v&$C0<$C0)*$08 + (v&$30<$30)*$04 + (v&$0C<$0C)*$02
  next

  poke pm.1+190,$7e:poke pm.1+215,$7e

  ' Move the mask into view
  PMHPOS 1,116
ENDPROC



@InitScreen
' @DEBUG_TEST_CARDS
@WelcomeScreen
@CallServer
@ResetScreen
'@ShowScreenF
@UpdateScreen

' ===================================
' MAIN PROGRAM LOOP

do
 @CallServer
 @UpdateScreen
 if len(requestedMove$)=0 then pause 20
 if key() 
  get K
    if k=80 and playerCount<8 and query$<>"": query$="?table=eric1&count=":query$=+str$(playerCount+1):endif
endif
loop


' ==========================================================
' DATA - Character Fonts
data font() byte = 0,0,0,0,0,0,0,0,
data byte = 170,170,170,170,170,170,170,170,
data byte = 170,174,187,187,171,174,186,191,
data byte = 170,174,187,171,174,171,187,174,
data byte = 170,171,187,187,191,171,171,171,
data byte = 170,191,186,190,171,171,171,190,
data byte = 170,175,186,190,187,187,187,174,
data byte = 170,191,187,171,174,174,174,174,
data byte = 170,174,187,187,174,187,187,174,
data byte = 170,174,187,187,187,175,171,190,
data byte = 170,186,187,187,187,187,187,186,
data byte = 170,234,186,186,186,186,186,234,
data byte = 170,175,171,171,171,187,187,174,
data byte = 170,174,187,187,187,187,174,171,
data byte = 170,187,187,190,190,187,187,187,
data byte = 170,174,187,187,191,187,187,187,
data byte = 0,32,136,136,136,136,136,32,
data byte = 0,32,160,32,32,32,32,168,
data byte = 0,32,136,136,8,32,128,168,
data byte = 0,32,136,8,32,8,136,32,
data byte = 0,8,136,136,168,8,8,8,
data byte = 0,168,128,160,8,8,8,160,
data byte = 0,40,128,160,136,136,136,32,
data byte = 0,168,136,8,32,32,32,32,
data byte = 0,32,136,136,32,136,136,32,
data byte = 0,32,136,136,136,40,8,160,
data byte = 0,0,32,32,0,0,32,32,
data byte = 0,0,0,0,0,3,15,12,
data byte = 0,0,0,0,192,240,60,12,
data byte = 12,12,12,15,3,0,0,0,
data byte = 12,12,12,60,240,192,0,0,
data byte = 12,12,12,12,12,12,12,12,
data byte = 0,0,0,0,255,255,0,0,
data byte = 0,32,168,136,136,168,136,136,
data byte = 0,160,136,136,160,136,136,160,
data byte = 0,40,128,128,128,128,128,40,
data byte = 0,160,136,136,136,136,136,160,
data byte = 0,168,136,128,160,128,128,168,
data byte = 0,168,136,128,160,128,128,128,
data byte = 0,40,136,128,152,136,136,40,
data byte = 0,136,136,136,168,136,136,136,
data byte = 0,168,32,32,32,32,32,168,
data byte = 0,40,8,8,8,8,136,32,
data byte = 0,136,136,160,160,136,136,136,
data byte = 0,128,128,128,128,128,128,168,
data byte = 0,136,168,168,136,136,136,136,
data byte = 0,136,136,168,168,168,136,136,
data byte = 0,32,136,136,136,136,136,32,
data byte = 0,160,136,136,136,160,128,128,
data byte = 0,32,136,136,136,136,32,8,
data byte = 0,160,136,136,136,160,136,136,
data byte = 0,40,136,128,32,8,136,160,
data byte = 0,168,32,32,32,32,32,32,
data byte = 0,136,136,136,136,136,136,168,
data byte = 0,136,136,136,136,168,32,32,
data byte = 0,136,136,136,136,168,168,136,
data byte = 0,136,136,136,32,136,136,136,
data byte = 0,136,136,136,168,32,32,32,
data byte = 0,168,8,32,32,128,128,168,
data byte = 0,0,0,0,0,0,0,0,
data byte = 76,76,19,19,196,196,49,49,
data byte = 77,77,17,17,197,197,49,49,
data byte = 169,169,169,169,169,169,169,169,
data byte = 169,233,185,185,185,185,185,233,
data byte = 171,175,175,175,175,171,171,170,
data byte = 186,254,254,254,254,250,250,234,
data byte = 170,171,175,175,175,171,170,170,
data byte = 234,250,254,254,254,250,234,170,
data byte = 171,171,170,175,175,175,170,171,
data byte = 250,250,234,254,190,190,234,250,
data byte = 170,171,171,175,175,175,170,171,
data byte = 234,250,250,254,254,190,234,250,
data byte = 6,6,6,6,6,6,6,6,
data byte = 1,1,1,1,1,1,1,1,
data byte = 64,64,64,64,64,64,64,64,
data byte = 0,0,0,0,0,0,1,1,
data byte = 5,13,3,0,0,0,0,0,
data byte = 0,0,0,0,0,85,85,170,
data byte = 0,0,0,0,0,81,85,165,
data byte = 170,85,85,255,0,0,0,0,
data byte = 165,85,95,240,0,0,0,0,
data byte = 0,0,0,0,0,21,85,106,
data byte = 0,0,0,0,0,84,85,169,
data byte = 106,85,213,63,0,0,0,0,
data byte = 169,85,87,252,0,0,0,0,
data byte = 0,0,0,0,0,21,85,113,
data byte = 0,0,0,0,0,84,85,49,
data byte = 127,85,213,63,0,0,0,0,
data byte = 77,85,87,252,0,0,0,0,
data byte = 255,252,240,240,192,192,192,0,
data byte = 255,63,15,15,3,3,3,0,
data byte = 0,192,192,192,240,240,252,255,
data byte = 0,3,3,3,15,15,63,255,
data byte = 0,0,0,0,0,0,0,0,
data byte = 0,0,0,0,0,0,0,0,
data byte = 0,0,0,0,0,0,0,0,
data byte = 174,191,191,191,191,175,175,171,
data byte = 233,249,249,249,249,233,233,169,
data byte = 171,175,191,191,191,175,171,170,
data byte = 169,233,249,249,249,233,169,169,
data byte = 175,175,171,191,190,190,171,175,
data byte = 233,233,169,249,249,249,169,233,
data byte = 171,175,175,191,191,190,171,175,
data byte = 169,233,233,249,249,249,169,233,
data byte = 0,0,0,64,0,0,0,0,
data byte = 0,0,0,0,0,0,16,16,
data byte = 16,32,168,169,168,168,32,16,
data byte = 0,48,252,253,252,252,48,16,
data byte = 16,16,16,85,16,16,16,16,
data byte = 16,16,16,85,16,16,16,0,
data byte = 0,0,16,21,16,16,0,0,
data byte = 0,48,116,220,220,220,116,48,
data byte = 0,48,184,236,236,236,184,48,
data byte = 0,40,170,170,174,174,40,0,
data byte = 0,40,170,170,186,186,40,0,
data byte = 0,32,236,184,184,184,236,32,
data byte = 0,0,0,0,0,32,32,128,
data byte = 170,170,85,0,0,0,164,169,
data byte = 0,148,164,164,164,164,164,148,
data byte = 0,124,92,92,92,92,92,124,
data byte = 0,0,0,32,24,20,28,48,
data byte = 0,0,0,32,144,80,208,48,
data byte = 0,0,0,0,0,0,0,0,
data byte = 0,0,0,0,0,0,0,0,
data byte = 0,0,0,0,0,0,0,0,
data byte = 0,0,0,0,0,0,0,0,
data byte = 0,0,0,0,0,0,0,0,
data byte = 0,0,0,0,0,0,0,0


' ============================================================================
' Call to show the screen, or occasionally to stop Atari attract/screensaver color mode from occuring
PROC ShowScreen
  poke 77,0:poke 559,46+16
ENDPROC


' ============================================================================
' Call to clear the screen to an empty table
PROC ResetScreen
  poke 559,0
  PMHPOS 2,0
  @HidePlayerSecretCardMask
  mset screen,40*26,0
  
  ' Draw the four black corners of the screen
  poke screen, 89:poke screen+39,90
  poke screen+40*24, 91:poke screen+40*25-1,92
ENDPROC


' ============================================================================
' Init screen/graphics - leaves screen blank. ShowScreen must be called afer
PROC InitScreen

  graphics 12+16

  ' ============= PLAYER MISSLE GRAPHICS =============

  ' Use player missle graphics as follows:
  ' Player 0 and 3 - Left and Right black bars to cover up the background to render a nice round table
  ' Player 1 - Darken player's secret card
  ' Player 2 - Move selection/active player indicator
  pmgraphics 1

  ' Keeping here in case I need it again - Set player missle priority: Players 0-1, playfield, players 2-3, background
   P.623,2

  ' Hide screen for faster startup
  poke 559,0
    
  ' Clear player data, then set sidebars
  mset pm.0,1024,0
  mset pm.0,255,255
  mset pm.3,255,255
  pm_loc = pm.0

  ' Make the sidebar and selection cursor 4x wide to block as much of the screen as possible, and the secret card 1x wide
  mset 53256,4,3: poke 53257, 0
  
  ' Set side par positions to left and right edge of screen
  PMHPOS 0,16:PMHPOS 3,208
  
  ' ============= COLORS =============

  ' Order: Players 0,1,2,3, Playfield 0,1,2,3, Background
  
  if PEEK(53268)=1 ' Check if we are running PAL on GTIA machines
    ' PAL colors
    move &""$00$0a$fa$00$78$0E$00$24$00+1, 704, 9
    background_color(0) = $A4
    move_color = $EE
  else
    ' NTSC colors
    move &""$00$0a$fa$00$88$0E$00$34$00+1, 704, 9
    move_color = $FE
  endif

  text_color(1) = move_color
  

  ' ============= PLAYFIELD =============

  screen = &screenBuffer
  
  ' Copy the custom character set data to the location
  move &font,&charBuffer,8*128

  ' Tell Atari to use the new location
  P.756,&charBuffer/256

  ' Custom Display List to give us 2 more rows (40x26)
  DL$ = ""$60$F0$44$00$00$04$04$04$04$04$04$04$04$04$04$04$04$04$04$04$04$04$04$04$04$04$04$04$84$20$04$41$00$00
  
  ' Copy the display list from the string to memory.
  displayList = &DL$+1
  dpoke displayList+len(DL$)-2,displayList
  dpoke 560, displayList

  ' Tell the display list the new location of the screen buffer
  dpoke displayList+3,&screenBuffer

  ' Use DLI to change the text/background colors of the bottom status row
  DLISET dli_colors = background_color INTO $D01A, text_color INTO $D017
  DLI dli_colors

  ' Reset the screen
  @ResetScreen
ENDPROC
