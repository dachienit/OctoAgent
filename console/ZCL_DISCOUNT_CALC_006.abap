CLASS ZCL_IYH1HC_TEST DEFINITION
  PUBLIC
  FINAL
  CREATE PUBLIC.

  PUBLIC SECTION.
    METHODS calculate_discount
      IMPORTING
        iv_amount TYPE decfloat16
      RETURNING
        VALUE(rv_discount) TYPE decfloat16.
ENDCLASS.

CLASS ZCL_IYH1HC_TEST IMPLEMENTATION.
  METHOD calculate_discount.
    DATA: lv_amount TYPE ZDE_AMOUNT.
    lv_amount = iv_amount / 100.
    IF lv_amount > 100.
      rv_discount = lv_amount * '0.10'.
    ELSE.
      rv_discount = '0.00'.
    ENDIF.
  ENDMETHOD.
ENDCLASS.