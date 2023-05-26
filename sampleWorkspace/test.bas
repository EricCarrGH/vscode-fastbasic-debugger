AA%=12.34
AB%=56.78

A=1
B=A+5


? "XYZ"
dim c4(3), c5(4), c6(5), c5b(4), A4%(3), A5%(4)

c4(2) = 4
c4(3) = c4(2) * 2
dim d2(1) byte, d3(2) byte

dim j4$(3), j5$(5)
hw$="Hello World mister cowboy"
hw$="Hello World"

? A

? Hw$
d3(0)=2:d3(1)=100

for i=0 to 3
  ' Some comment
  j4$(i)= "test-j4-string-": j4$(i)=+str$(i)
  j5$(i)= "test-j5-string-": j5$(i)=+str$(i)
  a4%(i) = 0.333*i
next

j5$(5)="TEST-5-MANUAL"
j5$(4)="TEST-4-MANUAL"
? "i: "; i; " @ "; &i

'======================
