CLASS lcl_customer_data_retriever DEFINITION FINAL CREATE PUBLIC.

  PUBLIC SECTION.
    "! <p>Customer Data Structure</p>
    TYPES:
      BEGIN OF ty_customer,
        kunnr TYPE kunnr,
        name1 TYPE name1_gp,
        ort01 TYPE ort01_gp,
      END OF ty_customer,
      "! <p>Table type for Customer Data</p>
      tt_customer TYPE STANDARD TABLE OF ty_customer WITH EMPTY KEY.

    "! <p>Type for Customer Number Range</p>
    TYPES:
      tt_customer_range TYPE RANGE OF kunnr.

    "! Retrieves customer master data based on a range of customer numbers.
    "! @parameter it_customer_range | Range table for customer numbers (like a SELECT-OPTION)
    "! @returning rt_customers      | A table with the found customer data
    METHODS get_customer_data
      IMPORTING
        it_customer_range   TYPE tt_customer_range
      RETURNING
        VALUE(rt_customers) TYPE tt_customer.

ENDCLASS.

CLASS lcl_customer_data_retriever IMPLEMENTATION.

  METHOD get_customer_data.
    " WARNING: In S/4HANA, customer data is part of the Business Partner model.
    " While KNA1 is available as a compatibility view, all new logic should be
    " migrated to use the new BP tables (e.g., BUT000) or preferably use a
    " standard CDS view like I_CUSTOMER to ensure future compatibility.
    "
    " --- Recommended S/4HANA Approach (using a CDS View) ---
    " SELECT Customer, CustomerName, CityName
    "   FROM I_Customer
    "   WHERE Customer IN @it_customer_range
    "   INTO TABLE @DATA(lt_bp_customers).
    " " Additional mapping logic would be required for rt_customers.

    SELECT kunnr, name1, ort01
      FROM kna1
      WHERE kunnr IN @it_customer_range
      INTO TABLE @rt_customers.

  ENDMETHOD.

ENDCLASS.