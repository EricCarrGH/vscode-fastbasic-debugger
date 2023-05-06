; Imported symbols
	.globalzp IOERROR

; Exported symbols
	.export bytecode_start

	.include "target.inc"

; TOKENS:
	.importzp	TOK_0
	.importzp	TOK_1
	.importzp	TOK_ADD
	.importzp	TOK_ADD_VAR
	.importzp	TOK_BGET
	.importzp	TOK_BPUT
	.importzp	TOK_BYTE
	.importzp	TOK_BYTE_PEEK
	.importzp	TOK_BYTE_PUT
	.importzp	TOK_CALL
	.importzp	TOK_CAT_STR
	.importzp	TOK_CJUMP
	.importzp	TOK_CLOSE
	.importzp	TOK_CNJUMP
	.importzp	TOK_COMP_0
	.importzp	TOK_COPY_STR
	.importzp	TOK_CSTRING
	.importzp	TOK_DIM
	.importzp	TOK_DPEEK
	.importzp	TOK_DPOKE
	.importzp	TOK_END
	.importzp	TOK_EQ
	.importzp	TOK_FLOAT
	.importzp	TOK_FOR
	.importzp	TOK_FOR_EXIT
	.importzp	TOK_FOR_NEXT
	.importzp	TOK_FP_MUL
	.importzp	TOK_FP_STORE
	.importzp	TOK_GET
	.importzp	TOK_GETKEY
	.importzp	TOK_GT
	.importzp	TOK_INCVAR
	.importzp	TOK_INT_FP
	.importzp	TOK_INT_STR
	.importzp	TOK_IOCHN
	.importzp	TOK_JUMP
	.importzp	TOK_L_AND
	.importzp	TOK_L_NOT
	.importzp	TOK_L_OR
	.importzp	TOK_MOD
	.importzp	TOK_MUL6
	.importzp	TOK_NEQ
	.importzp	TOK_NUM
	.importzp	TOK_PAUSE
	.importzp	TOK_POKE
	.importzp	TOK_POP
	.importzp	TOK_PRINT_STR
	.importzp	TOK_PUSH
	.importzp	TOK_PUSH_0
	.importzp	TOK_PUSH_1
	.importzp	TOK_PUSH_BYTE
	.importzp	TOK_PUSH_NUM
	.importzp	TOK_PUSH_VAR_LOAD
	.importzp	TOK_RET
	.importzp	TOK_SADDR
	.importzp	TOK_SUB
	.importzp	TOK_USHL
	.importzp	TOK_VAR_ADDR
	.importzp	TOK_VAR_LOAD
	.importzp	TOK_VAR_SADDR
	.importzp	TOK_VAR_STORE
	.importzp	TOK_VAR_STORE_0
	.importzp	TOK_XIO
;-----------------------------
; Macro to get variable ID from name
	.import __HEAP_RUN__
.macro makevar name
	.byte <((.ident (.concat ("fb_var_", name)) - __HEAP_RUN__)/2)
.endmacro
; Variables
	.segment "HEAP"
	.export fb_var_AA
fb_var_AA:	.res 6	; Float variable
	.export fb_var_AB
fb_var_AB:	.res 6	; Float variable
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
	.export fb_var_A4
fb_var_A4:	.res 2	; Float Array variable
	.export fb_var_A5
fb_var_A5:	.res 2	; Float Array variable
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
	.export fb_var_I
fb_var_I:	.res 2	; Word variable
	.export fb_var_MEM
fb_var_MEM:	.res 2	; Word variable
	.export fb_var_SIZE
fb_var_SIZE:	.res 2	; Word variable
	.export fb_var____DEBUG_ERR
fb_var____DEBUG_ERR:	.res 2	; Word variable
	.export fb_var____DEBUG_KEY
fb_var____DEBUG_KEY:	.res 2	; Word variable
	.export fb_var____DEBUG_MODE
fb_var____DEBUG_MODE:	.res 2	; Word variable
	.export fb_var____DEBUG_MEM
fb_var____DEBUG_MEM:	.res 2	; Word variable
	.export fb_var____DEBUG_LEN
fb_var____DEBUG_LEN:	.res 2	; Word variable
	.export fb_var____DEBUG_LINE
fb_var____DEBUG_LINE:	.res 2	; Word variable
	.export fb_var____DEBUG_MEMO
fb_var____DEBUG_MEMO:	.res 2	; Word variable
;-----------------------------
; Bytecode
	.segment "BYTECODE"
bytecode_start:
@FastBasic_LINE_1:	; LINE 1
	.byte	TOK_VAR_SADDR
	makevar	"AA"
	.byte	TOK_FLOAT
	.byte	$40, $12, $34, $00, $00, $00
	.byte	TOK_FP_STORE
@FastBasic_LINE_2:	; LINE 2
	.byte	TOK_VAR_SADDR
	makevar	"AB"
	.byte	TOK_FLOAT
	.byte	$40, $56, $78, $00, $00, $00
	.byte	TOK_FP_STORE
@FastBasic_LINE_4:	; LINE 4
	.byte	TOK_1
	.byte	TOK_VAR_STORE
	makevar	"A"
@FastBasic_LINE_5:	; LINE 5
	.byte	TOK_BYTE
	.byte	5
	.byte	TOK_ADD_VAR
	makevar	"A"
	.byte	TOK_VAR_STORE
	makevar	"B"
@FastBasic_LINE_7:	; LINE 7
	.byte	TOK_CSTRING
	.byte	4, "XYZ", 155
	.byte	TOK_PRINT_STR
@FastBasic_LINE_8:	; LINE 8
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
	.byte	TOK_BYTE
	.byte	4
	.byte	TOK_MUL6
	.byte	TOK_DIM
	makevar	"A4"
	.byte	TOK_BYTE
	.byte	5
	.byte	TOK_MUL6
	.byte	TOK_DIM
	makevar	"A5"
@FastBasic_LINE_10:	; LINE 10
	.byte	TOK_BYTE
	.byte	4
	.byte	TOK_ADD_VAR
	makevar	"C4"
	.byte	TOK_SADDR
	.byte	TOK_BYTE
	.byte	4
	.byte	TOK_DPOKE
@FastBasic_LINE_11:	; LINE 11
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
@FastBasic_LINE_12:	; LINE 12
	.byte	TOK_BYTE
	.byte	2
	.byte	TOK_DIM
	makevar	"D2"
	.byte	TOK_BYTE
	.byte	3
	.byte	TOK_DIM
	makevar	"D3"
@FastBasic_LINE_14:	; LINE 14
	.byte	TOK_BYTE
	.byte	8
	.byte	TOK_DIM
	makevar	"J4"
	.byte	TOK_BYTE
	.byte	12
	.byte	TOK_DIM
	makevar	"J5"
@FastBasic_LINE_15:	; LINE 15
	.byte	TOK_VAR_SADDR
	makevar	"HW"
	.byte	TOK_CSTRING
	.byte	25, "Hello World mister cowboy"
	.byte	TOK_COPY_STR
@FastBasic_LINE_16:	; LINE 16
	.byte	TOK_VAR_SADDR
	makevar	"HW"
	.byte	TOK_CSTRING
	.byte	11, "Hello World"
	.byte	TOK_COPY_STR
@FastBasic_LINE_18:	; LINE 18
	.byte	TOK_VAR_LOAD
	makevar	"HW"
	.byte	TOK_PRINT_STR
	.byte	TOK_BYTE_PUT
	.byte	155
@FastBasic_LINE_19:	; LINE 19
	.byte	TOK_VAR_LOAD
	makevar	"D3"
	.byte	TOK_SADDR
	.byte	TOK_BYTE
	.byte	2
	.byte	TOK_POKE
	.byte	TOK_1
	.byte	TOK_ADD_VAR
	makevar	"D3"
	.byte	TOK_SADDR
	.byte	TOK_BYTE
	.byte	100
	.byte	TOK_POKE
@FastBasic_LINE_20:	; LINE 20
	.byte	TOK_VAR_SADDR
	makevar	"I"
	.byte	TOK_PUSH_0
	.byte	TOK_DPOKE
	.byte	TOK_BYTE
	.byte	3
	.byte	TOK_PUSH_1
	.byte	TOK_FOR
	.byte	TOK_CNJUMP
	.word	jump_lbl_1
jump_lbl_2:
@FastBasic_LINE_21:	; LINE 21
	.byte	TOK_VAR_LOAD
	makevar	"I"
	.byte	TOK_USHL
	.byte	TOK_ADD_VAR
	makevar	"J4"
	.byte	TOK_SADDR
	.byte	TOK_CSTRING
	.byte	15, "test-j4-string-"
	.byte	TOK_COPY_STR
	.byte	TOK_VAR_LOAD
	makevar	"I"
	.byte	TOK_USHL
	.byte	TOK_ADD_VAR
	makevar	"J4"
	.byte	TOK_SADDR
	.byte	TOK_VAR_LOAD
	makevar	"I"
	.byte	TOK_INT_STR
	.byte	TOK_CAT_STR
@FastBasic_LINE_22:	; LINE 22
	.byte	TOK_VAR_LOAD
	makevar	"I"
	.byte	TOK_USHL
	.byte	TOK_ADD_VAR
	makevar	"J5"
	.byte	TOK_SADDR
	.byte	TOK_CSTRING
	.byte	15, "test-j5-string-"
	.byte	TOK_COPY_STR
	.byte	TOK_VAR_LOAD
	makevar	"I"
	.byte	TOK_USHL
	.byte	TOK_ADD_VAR
	makevar	"J5"
	.byte	TOK_SADDR
	.byte	TOK_VAR_LOAD
	makevar	"I"
	.byte	TOK_INT_STR
	.byte	TOK_CAT_STR
@FastBasic_LINE_23:	; LINE 23
	.byte	TOK_VAR_LOAD
	makevar	"A4"
	.byte	TOK_PUSH_VAR_LOAD
	makevar	"I"
	.byte	TOK_MUL6
	.byte	TOK_ADD
	.byte	TOK_SADDR
	.byte	TOK_FLOAT
	.byte	$3F, $33, $30, $00, $00, $00
	.byte	TOK_VAR_LOAD
	makevar	"I"
	.byte	TOK_INT_FP
	.byte	TOK_FP_MUL
	.byte	TOK_FP_STORE
@FastBasic_LINE_24:	; LINE 24
	.byte	TOK_FOR_NEXT
	.byte	TOK_CJUMP
	.word	jump_lbl_2
jump_lbl_1:
	.byte	TOK_FOR_EXIT
@FastBasic_LINE_26:	; LINE 26
	.byte	TOK_BYTE
	.byte	10
	.byte	TOK_ADD_VAR
	makevar	"J5"
	.byte	TOK_SADDR
	.byte	TOK_CSTRING
	.byte	13, "TEST-5-MANUAL"
	.byte	TOK_COPY_STR
@FastBasic_LINE_27:	; LINE 27
	.byte	TOK_BYTE
	.byte	8
	.byte	TOK_ADD_VAR
	makevar	"J5"
	.byte	TOK_SADDR
	.byte	TOK_CSTRING
	.byte	13, "TEST-4-MANUAL"
	.byte	TOK_COPY_STR
@FastBasic_LINE_28:	; LINE 28
	.byte	TOK_CSTRING
	.byte	3, "i: "
	.byte	TOK_PRINT_STR
	.byte	TOK_VAR_LOAD
	makevar	"I"
	.byte	TOK_INT_STR
	.byte	TOK_PRINT_STR
	.byte	TOK_CSTRING
	.byte	3, " @ "
	.byte	TOK_PRINT_STR
	.byte	TOK_VAR_ADDR
	makevar	"I"
	.byte	TOK_INT_STR
	.byte	TOK_PRINT_STR
	.byte	TOK_BYTE_PUT
	.byte	155
@FastBasic_LINE_40:	; LINE 40
	.byte	TOK_1
	.byte	TOK_PUSH
	.byte	TOK_CALL
	.word	fb_lbl____DEBUG_BP
@FastBasic_LINE_41:	; LINE 41
	.byte	TOK_GETKEY
	.byte	TOK_VAR_STORE
	makevar	"___DEBUG_KEY"
@FastBasic_LINE_42:	; LINE 42
	.byte	TOK_END
@FastBasic_LINE_47:	; LINE 47
	.segment "BYTECODE"
	.export	fb_lbl____DEBUG_BP
fb_lbl____DEBUG_BP:
	.byte	TOK_POP
	.byte	TOK_VAR_STORE
	makevar	"___DEBUG_LINE"
@FastBasic_LINE_48:	; LINE 48
	.byte	TOK_CSTRING
	.byte	13, "[BREAKPOINT]", 155
	.byte	TOK_PRINT_STR
@FastBasic_LINE_50:	; LINE 50
	.byte	TOK_BYTE
	.byte	5
	.byte	TOK_CLOSE
@FastBasic_LINE_51:	; LINE 51
jump_lbl_7:
@FastBasic_LINE_52:	; LINE 52
	.byte	TOK_BYTE
	.byte	5
	.byte	TOK_PUSH_BYTE
	.byte	3
	.byte	TOK_PUSH_BYTE
	.byte	4
	.byte	TOK_PUSH
	.byte	TOK_CSTRING
	.byte	11, "H4:debug.in"
	.byte	TOK_XIO
@FastBasic_LINE_53:	; LINE 53
	.byte	TOK_BYTE_PEEK
	.byte	IOERROR
	.byte	TOK_PUSH_1
	.byte	TOK_EQ
	.byte	TOK_CJUMP
	.word	jump_lbl_8
@FastBasic_LINE_54:	; LINE 54
	.byte	TOK_BYTE
	.byte	5
	.byte	TOK_IOCHN
	.byte	TOK_GET
	.byte	TOK_VAR_STORE
	makevar	"___DEBUG_MODE"
	.byte	TOK_0
	.byte	TOK_IOCHN
@FastBasic_LINE_55:	; LINE 55
	.byte	TOK_CSTRING
	.byte	12, "[DEBUG MODE "
	.byte	TOK_PRINT_STR
	.byte	TOK_VAR_LOAD
	makevar	"___DEBUG_MODE"
	.byte	TOK_INT_STR
	.byte	TOK_PRINT_STR
@FastBasic_LINE_56:	; LINE 56
	.byte	TOK_BYTE_PUT
	.byte	93
	.byte	TOK_BYTE_PUT
	.byte	155
	.byte	TOK_VAR_LOAD
	makevar	"___DEBUG_MODE"
	.byte	TOK_COMP_0
	.byte	TOK_L_NOT
	.byte	TOK_PUSH
	.byte	TOK_BYTE_PEEK
	.byte	IOERROR
	.byte	TOK_PUSH_1
	.byte	TOK_NEQ
	.byte	TOK_L_OR
	.byte	TOK_CNJUMP
	.word	jump_lbl_7_x
@FastBasic_LINE_58:	; LINE 58
	.byte	TOK_VAR_LOAD
	makevar	"___DEBUG_MODE"
	.byte	TOK_PUSH_BYTE
	.byte	2
	.byte	TOK_EQ
	.byte	TOK_CJUMP
	.word	jump_lbl_10
@FastBasic_LINE_60:	; LINE 60
	.byte	TOK_BYTE
	.byte	4
	.byte	TOK_CLOSE
	.byte	TOK_BYTE
	.byte	4
	.byte	TOK_PUSH_BYTE
	.byte	3
	.byte	TOK_PUSH_BYTE
	.byte	8
	.byte	TOK_PUSH
	.byte	TOK_CSTRING
	.byte	12, "H4:debug.out"
	.byte	TOK_XIO
@FastBasic_LINE_61:	; LINE 61
jump_lbl_11:
@FastBasic_LINE_63:	; LINE 63
	.byte	TOK_VAR_STORE_0
	makevar	"___DEBUG_MEM"
	.byte	TOK_BYTE
	.byte	5
	.byte	TOK_PUSH
	.byte	TOK_VAR_ADDR
	makevar	"___DEBUG_MEM"
	.byte	TOK_PUSH_BYTE
	.byte	4
	.byte	TOK_BGET
	.byte	TOK_VAR_LOAD
	makevar	"___DEBUG_MEM"
	.byte	TOK_COMP_0
	.byte	TOK_CJUMP
	.word	jump_lbl_11_x
@FastBasic_LINE_68:	; LINE 68
	.byte	TOK_VAR_LOAD
	makevar	"___DEBUG_MEM"
	.byte	TOK_VAR_STORE
	makevar	"___DEBUG_MEMO"
@FastBasic_LINE_69:	; LINE 69
	.byte	TOK_VAR_LOAD
	makevar	"___DEBUG_MODE"
	.byte	TOK_PUSH_NUM
	.word	1002
	.byte	TOK_EQ
	.byte	TOK_CJUMP
	.word	jump_lbl_13
	.byte	TOK_VAR_LOAD
	makevar	"___DEBUG_MEM"
	.byte	TOK_DPEEK
	.byte	TOK_VAR_STORE
	makevar	"___DEBUG_MEM"
jump_lbl_13:
@FastBasic_LINE_70:	; LINE 70
	.byte	TOK_NUM
	.word	1002
	.byte	TOK_VAR_STORE
	makevar	"___DEBUG_MODE"
@FastBasic_LINE_73:	; LINE 73
	.byte	TOK_VAR_LOAD
	makevar	"___DEBUG_LEN"
	.byte	TOK_PUSH_NUM
	.word	256
	.byte	TOK_MOD
	.byte	TOK_COMP_0
	.byte	TOK_L_NOT
	.byte	TOK_PUSH_VAR_LOAD
	makevar	"___DEBUG_LEN"
	.byte	TOK_PUSH_NUM
	.word	256
	.byte	TOK_GT
	.byte	TOK_L_AND
	.byte	TOK_CJUMP
	.word	jump_lbl_14
@FastBasic_LINE_74:	; LINE 74
jump_lbl_15:
	.byte	TOK_VAR_LOAD
	makevar	"___DEBUG_LEN"
	.byte	TOK_PUSH_0
	.byte	TOK_GT
	.byte	TOK_CJUMP
	.word	jump_lbl_11
@FastBasic_LINE_76:	; LINE 76
	.byte	TOK_BYTE
	.byte	4
	.byte	TOK_PUSH_VAR_LOAD
	makevar	"___DEBUG_MEM"
	.byte	TOK_DPEEK
	.byte	TOK_PUSH_NUM
	.word	256
	.byte	TOK_BPUT
@FastBasic_LINE_77:	; LINE 77
	.byte	TOK_INCVAR
	makevar	"___DEBUG_MEM"
	.byte	TOK_INCVAR
	makevar	"___DEBUG_MEM"
@FastBasic_LINE_78:	; LINE 78
	.byte	TOK_VAR_LOAD
	makevar	"___DEBUG_LEN"
	.byte	TOK_PUSH_NUM
	.word	256
	.byte	TOK_SUB
	.byte	TOK_VAR_STORE
	makevar	"___DEBUG_LEN"
@FastBasic_LINE_79:	; LINE 79
	.byte	TOK_JUMP
	.word	jump_lbl_15
@FastBasic_LINE_80:	; LINE 80
jump_lbl_14:
@FastBasic_LINE_82:	; LINE 82
	.byte	TOK_BYTE
	.byte	4
	.byte	TOK_PUSH_VAR_LOAD
	makevar	"___DEBUG_MEM"
	.byte	TOK_PUSH_VAR_LOAD
	makevar	"___DEBUG_LEN"
	.byte	TOK_BPUT
@FastBasic_LINE_90:	; LINE 90
	.byte	TOK_JUMP
	.word	jump_lbl_11
jump_lbl_11_x:
@FastBasic_LINE_91:	; LINE 91
	.byte	TOK_BYTE
	.byte	4
	.byte	TOK_CLOSE
@FastBasic_LINE_92:	; LINE 92
	.byte	TOK_JUMP
	.word	jump_lbl_18
jump_lbl_10:
	.byte	TOK_VAR_LOAD
	makevar	"___DEBUG_MODE"
	.byte	TOK_PUSH_BYTE
	.byte	3
	.byte	TOK_EQ
	.byte	TOK_CJUMP
	.word	jump_lbl_18
@FastBasic_LINE_94:	; LINE 94
jump_lbl_18:
@FastBasic_LINE_95:	; LINE 95
	.byte	TOK_BYTE
	.byte	5
	.byte	TOK_CLOSE
@FastBasic_LINE_96:	; LINE 96
	.byte	TOK_BYTE
	.byte	5
	.byte	TOK_PUSH_BYTE
	.byte	33
	.byte	TOK_PUSH_0
	.byte	TOK_PUSH
	.byte	TOK_CSTRING
	.byte	11, "H4:debug.in"
	.byte	TOK_XIO
@FastBasic_LINE_98:	; LINE 98
jump_lbl_8:
@FastBasic_LINE_99:	; LINE 99
	.byte	TOK_BYTE
	.byte	10
	.byte	TOK_PAUSE
@FastBasic_LINE_100:	; LINE 100
	.byte	TOK_JUMP
	.word	jump_lbl_7
jump_lbl_7_x:
@FastBasic_LINE_102:	; LINE 102
	.byte	TOK_CSTRING
	.byte	9, "[RESUME]", 155
	.byte	TOK_PRINT_STR
@FastBasic_LINE_103:	; LINE 103
	.byte	TOK_RET
