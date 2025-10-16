#!/bin/bash

# Script to help clean up console logs in the project
# Usage: ./cleanup-logs.sh [mode]
# Modes: 
#   - check: Show all console logs found (default)
#   - remove-debug: Remove console.log statements but keep error/warn
#   - replace: Replace console with logger utility (requires manual review)

MODE="${1:-check}"
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "🔍 Console Log Cleanup Tool"
echo "Mode: $MODE"
echo "Project root: $PROJECT_ROOT"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Files to exclude from cleanup
EXCLUDE_DIRS="-not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' -not -path '*/build/*'"
INCLUDE_EXTENSIONS="-name '*.js' -o -name '*.ts' -o -name '*.vue'"

count_console_logs() {
    echo -e "${BLUE}📊 Console Log Statistics:${NC}"
    
    # Count by type
    echo "Frontend Vue files:"
    find "$PROJECT_ROOT/frontend" $EXCLUDE_DIRS \( $INCLUDE_EXTENSIONS \) -exec grep -l "console\." {} \; 2>/dev/null | wc -l | xargs echo "  Files with console statements:"
    find "$PROJECT_ROOT/frontend" $EXCLUDE_DIRS \( $INCLUDE_EXTENSIONS \) -exec grep -o "console\.log" {} \; 2>/dev/null | wc -l | xargs echo "  console.log calls:"
    find "$PROJECT_ROOT/frontend" $EXCLUDE_DIRS \( $INCLUDE_EXTENSIONS \) -exec grep -o "console\.error" {} \; 2>/dev/null | wc -l | xargs echo "  console.error calls:"
    find "$PROJECT_ROOT/frontend" $EXCLUDE_DIRS \( $INCLUDE_EXTENSIONS \) -exec grep -o "console\.warn" {} \; 2>/dev/null | wc -l | xargs echo "  console.warn calls:"
    
    echo ""
    echo "Backend API files:"
    find "$PROJECT_ROOT/api" $EXCLUDE_DIRS \( $INCLUDE_EXTENSIONS \) -exec grep -l "console\." {} \; 2>/dev/null | wc -l | xargs echo "  Files with console statements:"
    find "$PROJECT_ROOT/api" $EXCLUDE_DIRS \( $INCLUDE_EXTENSIONS \) -exec grep -o "console\.log" {} \; 2>/dev/null | wc -l | xargs echo "  console.log calls:"
    find "$PROJECT_ROOT/api" $EXCLUDE_DIRS \( $INCLUDE_EXTENSIONS \) -exec grep -o "console\.error" {} \; 2>/dev/null | wc -l | xargs echo "  console.error calls:"
    find "$PROJECT_ROOT/api" $EXCLUDE_DIRS \( $INCLUDE_EXTENSIONS \) -exec grep -o "console\.warn" {} \; 2>/dev/null | wc -l | xargs echo "  console.warn calls:"
    echo ""
}

show_console_logs() {
    echo -e "${YELLOW}🔍 Found console statements:${NC}"
    
    # Frontend
    echo -e "${BLUE}Frontend files:${NC}"
    find "$PROJECT_ROOT/frontend" $EXCLUDE_DIRS \( $INCLUDE_EXTENSIONS \) -exec grep -Hn "console\." {} \; 2>/dev/null | head -20
    
    echo ""
    echo -e "${BLUE}Backend files:${NC}"
    find "$PROJECT_ROOT/api" $EXCLUDE_DIRS \( $INCLUDE_EXTENSIONS \) -exec grep -Hn "console\." {} \; 2>/dev/null | head -20
    
    echo ""
    echo -e "${YELLOW}Note: Showing first 20 matches from each area. Use 'grep -r \"console\.\" .' for full list.${NC}"
}

remove_debug_logs() {
    echo -e "${RED}⚠️  This will remove console.log statements but keep console.error/console.warn${NC}"
    echo "Press Enter to continue or Ctrl+C to cancel..."
    read
    
    # Create backup
    BACKUP_DIR="$PROJECT_ROOT/backup-$(date +%Y%m%d-%H%M%S)"
    echo "Creating backup in $BACKUP_DIR..."
    mkdir -p "$BACKUP_DIR"
    cp -r "$PROJECT_ROOT/frontend" "$BACKUP_DIR/" 2>/dev/null || true
    cp -r "$PROJECT_ROOT/api" "$BACKUP_DIR/" 2>/dev/null || true
    
    # Remove console.log (but not console.error/warn/info)
    find "$PROJECT_ROOT" $EXCLUDE_DIRS \( $INCLUDE_EXTENSIONS \) -exec sed -i.bak '/console\.log/d' {} \; 2>/dev/null
    
    # Clean up .bak files
    find "$PROJECT_ROOT" -name "*.bak" -delete 2>/dev/null || true
    
    echo -e "${GREEN}✅ Debug logs removed. Backup created in $BACKUP_DIR${NC}"
}

replace_with_logger() {
    echo -e "${RED}⚠️  This will attempt to replace console calls with logger utility${NC}"
    echo "This requires manual review and testing!"
    echo "Press Enter to continue or Ctrl+C to cancel..."
    read
    
    # Create backup
    BACKUP_DIR="$PROJECT_ROOT/backup-$(date +%Y%m%d-%H%M%S)"
    echo "Creating backup in $BACKUP_DIR..."
    mkdir -p "$BACKUP_DIR"
    cp -r "$PROJECT_ROOT/frontend" "$BACKUP_DIR/" 2>/dev/null || true
    cp -r "$PROJECT_ROOT/api" "$BACKUP_DIR/" 2>/dev/null || true
    
    echo "⚠️  This is a complex operation that requires manual review."
    echo "Consider using search/replace in your IDE instead."
    echo "Example replacements needed:"
    echo "  console.log(...) -> logger.debug(...)"
    echo "  console.error(...) -> logger.error(...)"
    echo "  console.warn(...) -> logger.warn(...)"
    echo "And adding logger imports to each file."
    
    echo -e "${GREEN}✅ Backup created in $BACKUP_DIR${NC}"
    echo "Use your IDE for safer batch replacements."
}

case "$MODE" in
    "check")
        count_console_logs
        show_console_logs
        ;;
    "remove-debug")
        count_console_logs
        remove_debug_logs
        count_console_logs
        ;;
    "replace")
        replace_with_logger
        ;;
    *)
        echo "Invalid mode: $MODE"
        echo "Available modes: check, remove-debug, replace"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}💡 Next steps:${NC}"
echo "1. Set LOG_LEVEL environment variables (see .env.example files)"
echo "2. Import and use logger utility in files with remaining console statements"
echo "3. Test your application to ensure it works correctly"
echo "4. In production, set LOG_LEVEL=WARN or ERROR to minimize output"