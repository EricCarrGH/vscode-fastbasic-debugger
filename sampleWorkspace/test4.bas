sf$="sdf"
st$="NNN"
f1=&sf$+1
t1=&st$+1
timer
t=time
FOR i=1 to 1w000
move f1,t1,3
next
t=time-t
? t*17
@SOMEPROC:? "line 1"
@SOMEPROC:? "line 2"
@SOMEPROC:@SECONDPROC 23:? "line 3"
@SOMEPROC:? "line 4"
@SOMEPROC:? "line 5"
@SOMEPROC:? "line 6"
@SOMEPROC:? "line 7"
@SOMEPROC:? "line 8"
@SOMEPROC:? "line 9"
@SOMEPROC:? "line 10"

@SOMEPROC:? "line 11"
@SOMEPROC:? "line 12"
@SOMEPROC:? "line 13"
@SOMEPROC:? "line 14"
@SOMEPROC:? "line 15"

PROC SECONDPROC2 f e
 @SOMEPROC:? "PROC2 LINE 19"
ENDPROC


PROC SECONDPROC f
@SOMEPROC:? "PROC LINE 24"
@SOMEPROC:@SECONDPROC2 1, 4:? "PROC LINE 25"
ENDPROC

'HEX$="0123456789ABCDEF"
DATA ml() byte= $BA, $60
PROC SOMEPROC
i = usr(&ml)
__POINTER=$100+peek(&i+1)+3
DB$="":D% = dpeek(__POINTER):IF D%<0 T.D%=D%+65536
'? d%
d%=d%-3*256
'? d%
WHILE D%>0:DR=INT(D%-16*INT(D%/16-0.5)):DB$=+CHR$(((DR>9)*55)+((DR<10)*$30)+DR):D%=INT(D%/16-0.5):WEND
? "Line At: ";db$[2,1];db$[1,1];db$[4,1];db$[3,1];" ";
'?"Line At: "; hex$[peek($01F6)/16+1,1];hex$[peek($01F6) mod 16+1,1];" ";peek($01F7)

GET K
ENDPROC
