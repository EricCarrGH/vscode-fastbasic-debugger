A=1
? "A = "; A
? "A = "; A

? "Address of A"; &A

a=23543

loc = &a

hello$ = "Hello World"
? HELLO$


dim ID(3), player$(3)

for i=0 to 3
  id(i) = 1000+i
  player$(i) = "PLAYER "
  player$(i) =+str$(i)
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