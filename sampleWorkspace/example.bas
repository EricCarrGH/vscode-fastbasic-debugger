proc someProc
print "123"
print "456"
@secondProc
endproc

proc secondProc
print "secondProc"
endproc

? "hello world"
@someProc
a$="123"
? a$