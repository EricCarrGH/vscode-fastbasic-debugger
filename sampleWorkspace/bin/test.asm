; Imported symbols

; Exported symbols
	.export bytecode_start

	.include "target.inc"

; TOKENS:
	.importzp	TOK_0
	.importzp	TOK_1
	.importzp	TOK_ADD_VAR
	.importzp	TOK_BYTE
	.importzp	TOK_BYTE_PUT
	.importzp	TOK_CLOSE
	.importzp	TOK_COPY_STR
	.importzp	TOK_CSTRING
	.importzp	TOK_DIM
	.importzp	TOK_END
	.importzp	TOK_GETKEY
	.importzp	TOK_IOCHN
	.importzp	TOK_PRINT_STR
	.importzp	TOK_PUSH
	.importzp	TOK_PUSH_BYTE
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
	.export fb_var_C
fb_var_C:	.res 2	; Word Array variable
	.export fb_var_D
fb_var_D:	.res 2	; Byte Array variable
	.export fb_var_HW
fb_var_HW:	.res 2	; String variable
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
	.byte	TOK_BYTE
	.byte	22
	.byte	TOK_DIM
	makevar	"C"
@FastBasic_LINE_4:	; LINE 4
	.byte	TOK_BYTE
	.byte	11
	.byte	TOK_DIM
	makevar	"D"
@FastBasic_LINE_5:	; LINE 5
	.byte	TOK_VAR_SADDR
	makevar	"HW"
	.byte	TOK_CSTRING
	.byte	11, "Hello World"
	.byte	TOK_COPY_STR
@FastBasic_LINE_7:	; LINE 7
	.byte	TOK_VAR_LOAD
	makevar	"HW"
	.byte	TOK_PRINT_STR
	.byte	TOK_BYTE_PUT
	.byte	155
@FastBasic_LINE_8:	; LINE 8
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
@FastBasic_LINE_10:	; LINE 10
	.byte	TOK_BYTE
	.byte	5
	.byte	TOK_IOCHN
	.byte	TOK_CSTRING
	.byte	18, "Hello World=23432", 155
	.byte	TOK_PRINT_STR
	.byte	TOK_0
	.byte	TOK_IOCHN
@FastBasic_LINE_11:	; LINE 11
	.byte	TOK_BYTE
	.byte	5
	.byte	TOK_IOCHN
	.byte	TOK_CSTRING
	.byte	17, "Hello World=3232", 155
	.byte	TOK_PRINT_STR
	.byte	TOK_0
	.byte	TOK_IOCHN
@FastBasic_LINE_12:	; LINE 12
	.byte	TOK_BYTE
	.byte	5
	.byte	TOK_CLOSE
@FastBasic_LINE_14:	; LINE 14
	.byte	TOK_GETKEY
	.byte	TOK_VAR_STORE
	makevar	"___DEBUG_KEY"
	.byte	TOK_END
