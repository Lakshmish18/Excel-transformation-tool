"""
Core transformation engine for applying operations to DataFrames.
"""
import logging
import pandas as pd
from typing import List, Dict, Any
from app.models.operations import Operation

logger = logging.getLogger(__name__)


class ColumnNotFoundError(Exception):
    """Custom exception for column not found errors."""
    def __init__(self, column_name: str, available_columns: List[str]):
        self.column_name = column_name
        self.available_columns = available_columns
        self.error_type = "COLUMN_NOT_FOUND"
        super().__init__(
            f"Column '{column_name}' not found. Available columns: {', '.join(available_columns)}"
        )


class OperationValidationError(Exception):
    """Custom exception for operation validation errors."""
    def __init__(self, operation_index: int, operation_id: str, operation_type: str, message: str):
        self.operation_index = operation_index
        self.operation_id = operation_id
        self.operation_type = operation_type
        self.message = message
        super().__init__(f"Operation {operation_index + 1} ({operation_type}): {message}")


def validate_column_exists(df: pd.DataFrame, column_name: str) -> None:
    """Validate that a column exists in the DataFrame."""
    if column_name not in df.columns:
        available_columns = [str(col) for col in df.columns]
        raise ColumnNotFoundError(column_name, available_columns)


def validate_filter_operation(df: pd.DataFrame, params: Dict[str, Any]) -> None:
    """Validate a filter operation."""
    column = params.get('column')
    operator = params.get('operator')
    if not column:
        raise ValueError("Filter operation missing 'column' parameter")
    if not operator:
        raise ValueError("Filter operation missing 'operator' parameter")
    validate_column_exists(df, column)
    valid_operators = {'equals', 'not_equals', 'greater_than', 'less_than', 
                      'greater_equal', 'less_equal', 'contains', 'not_contains', 'date_range'}
    if operator not in valid_operators:
        raise ValueError(f"Invalid operator: {operator}")


def apply_filter(df: pd.DataFrame, params: Dict[str, Any]) -> pd.DataFrame:
    """Apply a filter operation to a DataFrame."""
    column = params['column']
    operator = params['operator']
    value = params['value']
    validate_column_exists(df, column)
    df_result = df.copy()
    if operator == 'equals':
        return df_result[df_result[column] == value]
    elif operator == 'not_equals':
        return df_result[df_result[column] != value]
    elif operator == 'greater_than':
        return df_result[df_result[column] > value]
    elif operator == 'less_than':
        return df_result[df_result[column] < value]
    elif operator == 'greater_equal':
        return df_result[df_result[column] >= value]
    elif operator == 'less_equal':
        return df_result[df_result[column] <= value]
    elif operator == 'contains':
        return df_result[df_result[column].astype(str).str.contains(str(value), case=False, na=False)]
    elif operator == 'not_contains':
        return df_result[~df_result[column].astype(str).str.contains(str(value), case=False, na=False)]
    elif operator == 'date_range':
        start_date = pd.to_datetime(value['start'])
        end_date = pd.to_datetime(value['end'])
        df_result[column] = pd.to_datetime(df_result[column], errors='coerce')
        return df_result[(df_result[column] >= start_date) & (df_result[column] <= end_date)]
    else:
        raise ValueError(f"Unsupported operator: {operator}")


def validate_replace_operation(df: pd.DataFrame, params: Dict[str, Any]) -> None:
    """Validate a replace operation."""
    column = params.get('column')
    if not column:
        raise ValueError("Replace operation missing 'column' parameter")
    validate_column_exists(df, column)


def apply_replace(df: pd.DataFrame, params: Dict[str, Any]) -> pd.DataFrame:
    """Apply a replace operation to a DataFrame."""
    column = params.get('column') or params.get('column_name')  # Support both formats
    old_value = params.get('oldValue') or params.get('old_value')  # Support both formats
    new_value = params.get('newValue') or params.get('new_value')  # Support both formats
    
    if not column:
        raise ValueError("Replace operation missing 'column' parameter")
    if old_value is None:
        raise ValueError("Replace operation missing 'oldValue' parameter")
    if new_value is None:
        raise ValueError("Replace operation missing 'newValue' parameter")
    
    validate_column_exists(df, column)
    df_result = df.copy()
    
    # Handle type conversion for better matching
    # Try to convert old_value to match the column's dtype
    col_dtype = df_result[column].dtype
    
    logger.info(f"Replace operation: column={column}, old_value={old_value} (type: {type(old_value)}), new_value={new_value} (type: {type(new_value)}), col_dtype={col_dtype}")
    
    # If column is numeric, try converting old_value to numeric
    if pd.api.types.is_numeric_dtype(col_dtype):
        try:
            # Try to convert old_value to the same numeric type
            if pd.api.types.is_integer_dtype(col_dtype):
                old_value_converted = int(float(old_value)) if old_value is not None else old_value
                new_value_converted = int(float(new_value)) if new_value is not None else new_value
                logger.info(f"Converted to int: old={old_value_converted}, new={new_value_converted}")
            elif pd.api.types.is_float_dtype(col_dtype):
                old_value_converted = float(old_value) if old_value is not None else old_value
                new_value_converted = float(new_value) if new_value is not None else new_value
                logger.info(f"Converted to float: old={old_value_converted}, new={new_value_converted}")
            else:
                old_value_converted = old_value
                new_value_converted = new_value
        except (ValueError, TypeError) as e:
            # If conversion fails, keep original values
            logger.warning(f"Type conversion failed: {e}, using original values")
            old_value_converted = old_value
            new_value_converted = new_value
    else:
        old_value_converted = old_value
        new_value_converted = new_value
    
    # Log before replacement
    sample_before = df_result[column].head(5).tolist()
    logger.info(f"Before replace - sample values: {sample_before}")
    
    # Perform the replacement
    df_result[column] = df_result[column].replace(old_value_converted, new_value_converted)
    
    # Log after replacement
    sample_after = df_result[column].head(5).tolist()
    logger.info(f"After replace - sample values: {sample_after}")
    
    return df_result


def validate_math_operation(df: pd.DataFrame, params: Dict[str, Any]) -> None:
    """Validate a math operation."""
    col_a = params.get('colA')
    if not col_a:
        raise ValueError("Math operation missing 'colA' parameter")
    validate_column_exists(df, col_a)
    if not pd.api.types.is_numeric_dtype(df[col_a]):
        raise ValueError(f"Column '{col_a}' must be numeric for math operations")


def apply_math(df: pd.DataFrame, params: Dict[str, Any]) -> pd.DataFrame:
    """Apply a math operation to a DataFrame."""
    operation = params['operation']
    col_a = params['colA']
    col_b_or_value = params['colBOrValue']
    new_column = params['newColumn']
    validate_column_exists(df, col_a)
    validate_math_operation(df, params)  # Ensure col_a is numeric before proceeding
    df_result = df.copy()
    is_column = isinstance(col_b_or_value, str) and col_b_or_value in df.columns
    if is_column:
        validate_column_exists(df, col_b_or_value)
        series_b = df_result[col_b_or_value]
        # Ensure series_b is numeric for math
        if not pd.api.types.is_numeric_dtype(series_b):
            series_b = pd.to_numeric(series_b, errors='coerce')
    else:
        try:
            numeric_value = float(col_b_or_value)
            series_b = numeric_value
        except (ValueError, TypeError):
            available_columns = [str(col) for col in df.columns]
            raise ColumnNotFoundError(str(col_b_or_value), available_columns)
    try:
        if operation == 'add':
            df_result[new_column] = df_result[col_a] + series_b
        elif operation == 'subtract':
            df_result[new_column] = df_result[col_a] - series_b
        elif operation == 'multiply':
            df_result[new_column] = df_result[col_a] * series_b
        elif operation == 'divide':
            if is_column:
                # Avoid division by zero: replace 0 with NA
                divisor = series_b.replace(0, pd.NA)
                df_result[new_column] = df_result[col_a] / divisor
            else:
                if series_b == 0:
                    raise ValueError("Division by zero. Use a non-zero value or column.")
                df_result[new_column] = df_result[col_a] / series_b
        else:
            raise ValueError(f"Unsupported operation: {operation}")
    except (TypeError, ValueError) as e:
        raise ValueError(
            f"Math operation failed on column '{col_a}': {e}. "
            f"Ensure the column contains numeric values."
        ) from e
    return df_result


def validate_sort_operation(df: pd.DataFrame, params: Dict[str, Any]) -> None:
    """Validate a sort operation."""
    columns = params.get('columns', [])
    if not columns:
        raise ValueError("Sort operation missing 'columns' parameter")
    for col_config in columns:
        col_name = col_config.get('column')
        if col_name:
            validate_column_exists(df, col_name)


def apply_sort(df: pd.DataFrame, params: Dict[str, Any]) -> pd.DataFrame:
    """Apply a sort operation to a DataFrame."""
    columns = params['columns']
    sort_keys = [(col['column'], col.get('ascending', True)) for col in columns]
    return df.sort_values(by=[col for col, _ in sort_keys], ascending=[asc for _, asc in sort_keys])


def validate_select_columns_operation(df: pd.DataFrame, params: Dict[str, Any]) -> None:
    """Validate a select columns operation."""
    columns = params.get('columns', [])
    if not columns:
        raise ValueError("Select columns operation missing 'columns' parameter")
    for col in columns:
        validate_column_exists(df, col)


def apply_select_columns(df: pd.DataFrame, params: Dict[str, Any]) -> pd.DataFrame:
    """Apply a select columns operation to a DataFrame."""
    columns = params['columns']
    for col in columns:
        validate_column_exists(df, col)
    return df[columns]


def validate_remove_duplicates_operation(df: pd.DataFrame, params: Dict[str, Any]) -> None:
    """Validate a remove duplicates operation."""
    subset = params.get('subset')
    if subset:
        for col in subset:
            validate_column_exists(df, col)


def apply_remove_duplicates(df: pd.DataFrame, params: Dict[str, Any]) -> pd.DataFrame:
    """Apply a remove duplicates operation to a DataFrame."""
    subset = params.get('subset')
    return df.drop_duplicates(subset=subset)


def validate_aggregate_operation(df: pd.DataFrame, params: Dict[str, Any]) -> None:
    """Validate an aggregate operation."""
    aggregations = params.get('aggregations', {})
    if not aggregations:
        raise ValueError("Aggregate operation missing 'aggregations' parameter")
    group_by = params.get('groupBy', [])
    for col in group_by:
        validate_column_exists(df, col)
    for col in aggregations.keys():
        validate_column_exists(df, col)


def apply_aggregate(df: pd.DataFrame, params: Dict[str, Any]) -> pd.DataFrame:
    """Apply an aggregate operation to a DataFrame."""
    aggregations = params['aggregations']
    group_by = params.get('groupBy', [])
    if group_by:
        return df.groupby(group_by).agg(aggregations).reset_index()
    else:
        return df.agg(aggregations).to_frame().T


def validate_text_cleanup_operation(df: pd.DataFrame, params: Dict[str, Any]) -> None:
    """Validate a text cleanup operation."""
    column = params.get('column')
    if not column:
        raise ValueError("Text cleanup operation missing 'column' parameter")
    validate_column_exists(df, column)


def apply_text_cleanup(df: pd.DataFrame, params: Dict[str, Any]) -> pd.DataFrame:
    """Apply text cleanup operations to a DataFrame column."""
    column = params['column']
    operations = params['operations']
    validate_column_exists(df, column)
    df_result = df.copy()
    for op in operations:
        if op == 'trim':
            df_result[column] = df_result[column].astype(str).str.strip()
        elif op == 'lowercase':
            df_result[column] = df_result[column].astype(str).str.lower()
        elif op == 'uppercase':
            df_result[column] = df_result[column].astype(str).str.upper()
        elif op == 'remove_symbols':
            df_result[column] = df_result[column].astype(str).str.replace(r'[^a-zA-Z0-9\s]', '', regex=True)
    return df_result


def validate_split_column_operation(df: pd.DataFrame, params: Dict[str, Any]) -> None:
    """Validate a split column operation."""
    column = params.get('column')
    if not column:
        raise ValueError("Split column operation missing 'column' parameter")
    validate_column_exists(df, column)


def apply_split_column(df: pd.DataFrame, params: Dict[str, Any]) -> pd.DataFrame:
    """Apply a split column operation to a DataFrame."""
    column = params['column']
    separator = params['separator']
    new_columns = params['newColumns']
    validate_column_exists(df, column)
    df_result = df.copy()
    split_data = df_result[column].astype(str).str.split(separator, expand=True)
    for i, new_col in enumerate(new_columns):
        if i < len(split_data.columns):
            df_result[new_col] = split_data[i]
    return df_result


def validate_merge_columns_operation(df: pd.DataFrame, params: Dict[str, Any]) -> None:
    """Validate a merge columns operation."""
    columns = params.get('columns', [])
    if not columns or len(columns) < 2:
        raise ValueError("Merge columns operation requires at least 2 columns")
    for col in columns:
        validate_column_exists(df, col)


def apply_merge_columns(df: pd.DataFrame, params: Dict[str, Any]) -> pd.DataFrame:
    """Apply a merge columns operation to a DataFrame."""
    columns = params['columns']
    new_column = params['newColumn']
    separator = params.get('separator', ' ')
    for col in columns:
        validate_column_exists(df, col)
    df_result = df.copy()
    df_result[new_column] = df_result[columns].astype(str).agg(separator.join, axis=1)
    return df_result


def validate_date_format_operation(df: pd.DataFrame, params: Dict[str, Any]) -> None:
    """Validate a date format operation."""
    column = params.get('column')
    if not column:
        raise ValueError("Date format operation missing 'column' parameter")
    validate_column_exists(df, column)


def apply_date_format(df: pd.DataFrame, params: Dict[str, Any]) -> pd.DataFrame:
    """Apply a date format operation to a DataFrame."""
    column = params['column']
    output_format = params['outputFormat']
    validate_column_exists(df, column)
    df_result = df.copy()
    df_result[column] = pd.to_datetime(df_result[column], errors='coerce').dt.strftime(output_format)
    return df_result


def validate_remove_blank_rows_operation(df: pd.DataFrame, params: Dict[str, Any]) -> None:
    """Validate a remove blank rows operation."""
    columns = params.get('columns')
    if columns:
        for col in columns:
            validate_column_exists(df, col)


def apply_remove_blank_rows(df: pd.DataFrame, params: Dict[str, Any]) -> pd.DataFrame:
    """Apply a remove blank rows operation to a DataFrame."""
    columns = params.get('columns')
    if columns:
        return df.dropna(subset=columns)
    else:
        return df.dropna()


def validate_convert_to_numeric_operation(df: pd.DataFrame, params: Dict[str, Any]) -> None:
    """Validate a convert to numeric operation."""
    column = params.get('column')
    if not column:
        raise ValueError("Convert to numeric operation missing 'column' parameter")
    validate_column_exists(df, column)


def apply_convert_to_numeric(df: pd.DataFrame, params: Dict[str, Any]) -> pd.DataFrame:
    """Apply a convert to numeric operation to a DataFrame."""
    column = params['column']
    errors = params.get('errors', 'coerce')
    validate_column_exists(df, column)
    df_result = df.copy()
    df_result[column] = pd.to_numeric(df_result[column], errors=errors)
    return df_result


def validate_gross_profit_operation(df: pd.DataFrame, params: Dict[str, Any]) -> None:
    """Validate a gross profit operation."""
    revenue_col = params.get('revenueColumn')
    cogs_col = params.get('costOfGoodsSoldColumn')
    if not revenue_col or not cogs_col:
        raise ValueError("Gross profit operation missing required columns")
    validate_column_exists(df, revenue_col)
    validate_column_exists(df, cogs_col)


def apply_gross_profit(df: pd.DataFrame, params: Dict[str, Any]) -> pd.DataFrame:
    """Apply a gross profit operation to a DataFrame."""
    revenue_col = params['revenueColumn']
    cogs_col = params['costOfGoodsSoldColumn']
    new_column = params['newColumn']
    validate_column_exists(df, revenue_col)
    validate_column_exists(df, cogs_col)
    df_result = df.copy()
    df_result[new_column] = df_result[revenue_col] - df_result[cogs_col]
    return df_result


def validate_net_profit_operation(df: pd.DataFrame, params: Dict[str, Any]) -> None:
    """Validate a net profit operation."""
    gross_profit_col = params.get('grossProfitColumn')
    expenses_col = params.get('expensesColumn')
    if not gross_profit_col or not expenses_col:
        raise ValueError("Net profit operation missing required columns")
    validate_column_exists(df, gross_profit_col)
    validate_column_exists(df, expenses_col)


def apply_net_profit(df: pd.DataFrame, params: Dict[str, Any]) -> pd.DataFrame:
    """Apply a net profit operation to a DataFrame."""
    gross_profit_col = params['grossProfitColumn']
    expenses_col = params['expensesColumn']
    new_column = params['newColumn']
    validate_column_exists(df, gross_profit_col)
    validate_column_exists(df, expenses_col)
    df_result = df.copy()
    df_result[new_column] = df_result[gross_profit_col] - df_result[expenses_col]
    return df_result


def validate_profit_loss_operation(df: pd.DataFrame, params: Dict[str, Any]) -> None:
    """Validate a profit loss operation."""
    date_col = params.get('dateColumn')
    revenue_col = params.get('revenueColumn')
    cost_col = params.get('costColumn')
    if not date_col or not revenue_col or not cost_col:
        raise ValueError("Profit loss operation missing required columns")
    validate_column_exists(df, date_col)
    validate_column_exists(df, revenue_col)
    validate_column_exists(df, cost_col)


def apply_profit_loss(df: pd.DataFrame, params: Dict[str, Any]) -> pd.DataFrame:
    """Apply a profit loss operation to a DataFrame."""
    date_col = params['dateColumn']
    revenue_col = params['revenueColumn']
    cost_col = params['costColumn']
    period = params['period']
    validate_column_exists(df, date_col)
    validate_column_exists(df, revenue_col)
    validate_column_exists(df, cost_col)
    df_result = df.copy()
    df_result[date_col] = pd.to_datetime(df_result[date_col], errors='coerce')
    if period == 'monthly':
        df_result['Period'] = df_result[date_col].dt.to_period('M').astype(str)
    elif period == 'quarterly':
        df_result['Period'] = df_result[date_col].dt.to_period('Q').astype(str)
    else:
        raise ValueError(f"Invalid period: {period}")
    grouped = df_result.groupby('Period').agg({
        revenue_col: 'sum',
        cost_col: 'sum'
    }).reset_index()
    grouped['Profit'] = grouped[revenue_col] - grouped[cost_col]
    return grouped


def validate_operations(df: pd.DataFrame, operations: List[Operation]) -> List[Dict[str, Any]]:
    """Validate a list of operations, simulating application so later ops see new columns."""
    errors = []
    result_df = df.copy()
    for i, operation in enumerate(operations):
        try:
            if operation.type == 'filter':
                validate_filter_operation(result_df, operation.params)
            elif operation.type == 'replace':
                validate_replace_operation(result_df, operation.params)
            elif operation.type == 'math':
                validate_math_operation(result_df, operation.params)
            elif operation.type == 'sort':
                validate_sort_operation(result_df, operation.params)
            elif operation.type == 'select_columns':
                validate_select_columns_operation(result_df, operation.params)
            elif operation.type == 'remove_duplicates':
                validate_remove_duplicates_operation(result_df, operation.params)
            elif operation.type == 'aggregate':
                validate_aggregate_operation(result_df, operation.params)
            elif operation.type == 'text_cleanup':
                validate_text_cleanup_operation(result_df, operation.params)
            elif operation.type == 'split_column':
                validate_split_column_operation(result_df, operation.params)
            elif operation.type == 'merge_columns':
                validate_merge_columns_operation(result_df, operation.params)
            elif operation.type == 'date_format':
                validate_date_format_operation(result_df, operation.params)
            elif operation.type == 'remove_blank_rows':
                validate_remove_blank_rows_operation(result_df, operation.params)
            elif operation.type == 'convert_to_numeric':
                validate_convert_to_numeric_operation(result_df, operation.params)
            elif operation.type == 'gross_profit':
                validate_gross_profit_operation(result_df, operation.params)
            elif operation.type == 'net_profit':
                validate_net_profit_operation(result_df, operation.params)
            elif operation.type == 'profit_loss':
                validate_profit_loss_operation(result_df, operation.params)
            else:
                errors.append({
                    "opIndex": i,
                    "opId": getattr(operation, 'id', 'unknown'),
                    "opType": operation.type,
                    "message": f"Unknown operation type: {operation.type}"
                })
                continue
            # Validation passed: apply so next operation sees new columns (e.g. Gross Profit for net_profit)
            result_df = apply_operations(result_df, [operation])
        except OperationValidationError as e:
            errors.append({
                "opIndex": i,
                "opId": e.operation_id,
                "opType": e.operation_type,
                "message": e.message
            })
        except ColumnNotFoundError as e:
            errors.append({
                "opIndex": i,
                "opId": getattr(operation, 'id', 'unknown'),
                "opType": operation.type,
                "message": f"Column '{e.column_name}' not found. Available columns: {', '.join(e.available_columns)}"
            })
        except ValueError as e:
            errors.append({
                "opIndex": i,
                "opId": getattr(operation, 'id', 'unknown'),
                "opType": operation.type,
                "message": str(e)
            })
        except Exception as e:
            errors.append({
                "opIndex": i,
                "opId": getattr(operation, 'id', 'unknown'),
                "opType": operation.type,
                "message": f"Unexpected error: {str(e)}"
            })
    return errors


def apply_operations(df: pd.DataFrame, operations: List[Operation]) -> pd.DataFrame:
    """Apply a list of operations sequentially to a DataFrame."""
    result_df = df.copy()
    logger.info(f"Starting transformation pipeline with {len(operations)} operations")
    for i, operation in enumerate(operations):
        operation_id = getattr(operation, 'id', f'op-{i}')
        logger.info(f"Applying operation {i + 1}/{len(operations)}: {operation.type} (id: {operation_id})")
        try:
            if operation.type == 'filter':
                result_df = apply_filter(result_df, operation.params)
            elif operation.type == 'replace':
                result_df = apply_replace(result_df, operation.params)
            elif operation.type == 'math':
                result_df = apply_math(result_df, operation.params)
            elif operation.type == 'sort':
                result_df = apply_sort(result_df, operation.params)
            elif operation.type == 'select_columns':
                result_df = apply_select_columns(result_df, operation.params)
            elif operation.type == 'remove_duplicates':
                result_df = apply_remove_duplicates(result_df, operation.params)
            elif operation.type == 'aggregate':
                result_df = apply_aggregate(result_df, operation.params)
            elif operation.type == 'text_cleanup':
                result_df = apply_text_cleanup(result_df, operation.params)
            elif operation.type == 'split_column':
                result_df = apply_split_column(result_df, operation.params)
            elif operation.type == 'merge_columns':
                result_df = apply_merge_columns(result_df, operation.params)
            elif operation.type == 'date_format':
                result_df = apply_date_format(result_df, operation.params)
            elif operation.type == 'remove_blank_rows':
                result_df = apply_remove_blank_rows(result_df, operation.params)
            elif operation.type == 'convert_to_numeric':
                result_df = apply_convert_to_numeric(result_df, operation.params)
            elif operation.type == 'gross_profit':
                result_df = apply_gross_profit(result_df, operation.params)
            elif operation.type == 'net_profit':
                result_df = apply_net_profit(result_df, operation.params)
            elif operation.type == 'profit_loss':
                result_df = apply_profit_loss(result_df, operation.params)
            else:
                raise ValueError(f"Unknown operation type: {operation.type}")
            logger.info(f"Operation {i + 1} completed successfully")
        except ColumnNotFoundError as e:
            error_msg = f"Column '{e.column_name}' not found. Available columns: {', '.join(e.available_columns)}"
            logger.error(f"Operation {i + 1} failed: {error_msg}")
            raise OperationValidationError(i, operation_id, operation.type, error_msg) from e
        except ValueError as e:
            error_msg = str(e)
            logger.error(f"Operation {i + 1} failed: {error_msg}")
            raise OperationValidationError(i, operation_id, operation.type, error_msg) from e
        except Exception as e:
            error_msg = f"Unexpected error: {str(e)}"
            logger.error(f"Operation {i + 1} failed: {error_msg}")
            raise OperationValidationError(i, operation_id, operation.type, error_msg) from e
    logger.info(f"Transformation pipeline completed successfully. Final row count: {len(result_df)}")
    return result_df
