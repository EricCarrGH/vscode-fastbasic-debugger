PRINT "LINE 1"
PRINT "LINE 2"
PRINT "LINE 3"

PROC TESTPROC LINE
? "LINE 6"
? "LINE 7"
ENDPROC

@TESTPROC 1
PRINT "LINE 10"
@TESTPROC 3