; Imported symbols

; Exported symbols
	.export bytecode_start

	.include "target.inc"

; TOKENS:
	.importzp	TOK_1
	.importzp	TOK_ADD_VAR
	.importzp	TOK_BPUT
	.importzp	TOK_BYTE
	.importzp	TOK_BYTE_PUT
	.importzp	TOK_CJUMP
	.importzp	TOK_CLOSE
	.importzp	TOK_CNJUMP
	.importzp	TOK_COPY_STR
	.importzp	TOK_CSTRING
	.importzp	TOK_DIM
	.importzp	TOK_DPEEK
	.importzp	TOK_DPOKE
	.importzp	TOK_END
	.importzp	TOK_FOR
	.importzp	TOK_FOR_EXIT
	.importzp	TOK_FOR_NEXT
	.importzp	TOK_GETKEY
	.importzp	TOK_INCVAR
	.importzp	TOK_NUM
	.importzp	TOK_PRINT_STR
	.importzp	TOK_PUSH
	.importzp	TOK_PUSH_1
	.importzp	TOK_PUSH_BYTE
	.importzp	TOK_PUSH_NUM
	.importzp	TOK_SADDR
	.importzp	TOK_USHL
	.importzp	TOK_VAR_ADDR
	.importzp	TOK_VAR_LOAD
	.importzp	TOK_VAR_SADDR
	.importzp	TOK_VAR_STORE
	.importzp	TOK_XIO
;-----------------------------
; Macro to get variable ID from name
	.import __HEAP_RUN__
.macro makevar name
	.byte <((.ident (.concat ("fb_var_", name)) - __HEAP_RUN__)/2)
.endmacro
; Variables
	.segment "HEAP"
	.export fb_var_A
fb_var_A:	.res 2	; Word variable
	.export fb_var_B
fb_var_B:	.res 2	; Word variable
	.export fb_var_C4
fb_var_C4:	.res 2	; Word Array variable
	.export fb_var_C5
fb_var_C5:	.res 2	; Word Array variable
	.export fb_var_C6
fb_var_C6:	.res 2	; Word Array variable
	.export fb_var_C5B
fb_var_C5B:	.res 2	; Word Array variable
	.export fb_var_D2
fb_var_D2:	.res 2	; Byte Array variable
	.export fb_var_D3
fb_var_D3:	.res 2	; Byte Array variable
	.export fb_var_J4
fb_var_J4:	.res 2	; String Array variable
	.export fb_var_J5
fb_var_J5:	.res 2	; String Array variable
	.export fb_var_HW
fb_var_HW:	.res 2	; String variable
	.export fb_var____DEBUG_BUF
fb_var____DEBUG_BUF:	.res 2	; Word Array variable
	.export fb_var____DEBUG_VARS
fb_var____DEBUG_VARS:	.res 2	; Word variable
	.export fb_var_I
fb_var_I:	.res 2	; Word variable
	.export fb_var____DEBUG_KEY
fb_var____DEBUG_KEY:	.res 2	; Word variable
;-----------------------------
; Bytecode
	.segment "BYTECODE"
bytecode_start:
@FastBasic_LINE_1:	; LINE 1
	.byte	TOK_1
	.byte	TOK_VAR_STORE
	makevar	"A"
@FastBasic_LINE_2:	; LINE 2
	.byte	TOK_BYTE
	.byte	5
	.byte	TOK_ADD_VAR
	makevar	"A"
	.byte	TOK_VAR_STORE
	makevar	"B"
@FastBasic_LINE_3:	; LINE 3
	.byte	TOK_CSTRING
	.byte	4, "XXX", 155
	.byte	TOK_PRINT_STR
@FastBasic_LINE_4:	; LINE 4
	.byte	TOK_BYTE
	.byte	8
	.byte	TOK_DIM
	makevar	"C4"
	.byte	TOK_BYTE
	.byte	10
	.byte	TOK_DIM
	makevar	"C5"
	.byte	TOK_BYTE
	.byte	12
	.byte	TOK_DIM
	makevar	"C6"
	.byte	TOK_BYTE
	.byte	10
	.byte	TOK_DIM
	makevar	"C5B"
@FastBasic_LINE_7:	; LINE 7
	.byte	TOK_BYTE
	.byte	4
	.byte	TOK_ADD_VAR
	makevar	"C4"
	.byte	TOK_SADDR
	.byte	TOK_BYTE
	.byte	4
	.byte	TOK_DPOKE
@FastBasic_LINE_9:	; LINE 9
	.byte	TOK_BYTE
	.byte	6
	.byte	TOK_ADD_VAR
	makevar	"C4"
	.byte	TOK_SADDR
	.byte	TOK_BYTE
	.byte	4
	.byte	TOK_ADD_VAR
	makevar	"C4"
	.byte	TOK_DPEEK
	.byte	TOK_USHL
	.byte	TOK_DPOKE
@FastBasic_LINE_11:	; LINE 11
	.byte	TOK_CSTRING
	.byte	4, "XXX", 155
	.byte	TOK_PRINT_STR
@FastBasic_LINE_12:	; LINE 12
	.byte	TOK_BYTE
	.byte	2
	.byte	TOK_DIM
	makevar	"D2"
	.byte	TOK_BYTE
	.byte	3
	.byte	TOK_DIM
	makevar	"D3"
@FastBasic_LINE_13:	; LINE 13
	.byte	TOK_CSTRING
	.byte	4, "XXX", 155
	.byte	TOK_PRINT_STR
@FastBasic_LINE_14:	; LINE 14
	.byte	TOK_BYTE
	.byte	8
	.byte	TOK_DIM
	makevar	"J4"
	.byte	TOK_BYTE
	.byte	10
	.byte	TOK_DIM
	makevar	"J5"
@FastBasic_LINE_15:	; LINE 15
	.byte	TOK_CSTRING
	.byte	4, "XXX", 155
	.byte	TOK_PRINT_STR
@FastBasic_LINE_16:	; LINE 16
	.byte	TOK_VAR_SADDR
	makevar	"HW"
	.byte	TOK_CSTRING
	.byte	11, "Hello World"
	.byte	TOK_COPY_STR
@FastBasic_LINE_17:	; LINE 17
	.byte	TOK_VAR_LOAD
	makevar	"HW"
	.byte	TOK_PRINT_STR
	.byte	TOK_BYTE_PUT
	.byte	155
@FastBasic_LINE_18:	; LINE 18
	.byte	TOK_BYTE
	.byte	5
	.byte	TOK_PUSH_BYTE
	.byte	3
	.byte	TOK_PUSH_BYTE
	.byte	8
	.byte	TOK_PUSH
	.byte	TOK_CSTRING
	.byte	12, "H6:DEBUG.OUT"
	.byte	TOK_XIO
@FastBasic_LINE_20:	; LINE 20
	.byte	TOK_NUM
	.word	4002
	.byte	TOK_DIM
	makevar	"___DEBUG_BUF"
@FastBasic_LINE_21:	; LINE 21
	.byte	TOK_VAR_LOAD
	makevar	"___DEBUG_BUF"
	.byte	TOK_VAR_STORE
	makevar	"___DEBUG_VARS"
@FastBasic_LINE_22:	; LINE 22
	.byte	TOK_VAR_LOAD
	makevar	"___DEBUG_VARS"
	.byte	TOK_SADDR
	.byte	TOK_VAR_ADDR
	makevar	"A"
	.byte	TOK_DPOKE
	.byte	TOK_VAR_LOAD
	makevar	"___DEBUG_VARS"
	.byte	TOK_SADDR
	.byte	TOK_BYTE
	.byte	22
	.byte	TOK_DPOKE
	.byte	TOK_INCVAR
	makevar	"___DEBUG_VARS"
@FastBasic_LINE_23:	; LINE 23
	.byte	TOK_VAR_LOAD
	makevar	"___DEBUG_VARS"
	.byte	TOK_SADDR
	.byte	TOK_VAR_LOAD
	makevar	"C4"
	.byte	TOK_DPOKE
	.byte	TOK_VAR_LOAD
	makevar	"___DEBUG_VARS"
	.byte	TOK_SADDR
	.byte	TOK_BYTE
	.byte	8
	.byte	TOK_DPOKE
	.byte	TOK_INCVAR
	makevar	"___DEBUG_VARS"
@FastBasic_LINE_24:	; LINE 24
	.byte	TOK_VAR_LOAD
	makevar	"___DEBUG_VARS"
	.byte	TOK_SADDR
	.byte	TOK_VAR_LOAD
	makevar	"C5"
	.byte	TOK_DPOKE
	.byte	TOK_VAR_LOAD
	makevar	"___DEBUG_VARS"
	.byte	TOK_SADDR
	.byte	TOK_BYTE
	.byte	10
	.byte	TOK_DPOKE
	.byte	TOK_INCVAR
	makevar	"___DEBUG_VARS"
@FastBasic_LINE_26:	; LINE 26
	.byte	TOK_VAR_SADDR
	makevar	"I"
	.byte	TOK_PUSH_1
	.byte	TOK_DPOKE
	.byte	TOK_BYTE
	.byte	100
	.byte	TOK_PUSH_1
	.byte	TOK_FOR
	.byte	TOK_CNJUMP
	.word	jump_lbl_1
jump_lbl_2:
@FastBasic_LINE_27:	; LINE 27
	.byte	TOK_BYTE
	.byte	5
	.byte	TOK_PUSH
	.byte	TOK_VAR_ADDR
	makevar	"A"
	.byte	TOK_PUSH_NUM
	.word	256
	.byte	TOK_BPUT
@FastBasic_LINE_28:	; LINE 28
	.byte	TOK_FOR_NEXT
	.byte	TOK_CJUMP
	.word	jump_lbl_2
jump_lbl_1:
	.byte	TOK_FOR_EXIT
@FastBasic_LINE_31:	; LINE 31
	.byte	TOK_BYTE
	.byte	5
	.byte	TOK_CLOSE
@FastBasic_LINE_32:	; LINE 32
	.byte	TOK_CSTRING
	.byte	6, "wrote", 155
	.byte	TOK_PRINT_STR
@FastBasic_LINE_33:	; LINE 33
	.byte	TOK_GETKEY
	.byte	TOK_VAR_STORE
	makevar	"___DEBUG_KEY"
	.byte	TOK_END
