# CLEANUP AND STATE DISCIPLINE

Persistent state is a **failure risk**.
All temporary artifacts **MUST** be eliminated before work completion.

---

## 1. TEMPORARY ARTIFACTS (ZERO PERSISTENCE)

### Mandatory Deletion Targets
**ALL** of the following **MUST** be deleted in the same change that created them:

#### Generated Files
- Log files (`*.log`, `debug.txt`, etc.)
- Temporary scripts (`temp_*.py`, `test_runner.sh`, etc.)
- Build artifacts not in `.gitignore`
- Downloaded test files
- Generated mock data files

#### Development Artifacts
- Debugging print statement files
- Manual test scripts
- One-off utility scripts
- Scratch files

### Verification Command
Before completion, agent **MUST** run:
```bash
# List all files not in version control
git status --porcelain
```

**Expected output**: Only files intended for commit

**VIOLATION**: Any temporary files in output

---

## 2. TEST ARTIFACTS (MANDATORY CLEANUP)

### Test Data Deletion Rules
**ALL** test data **MUST** be deleted after test completion:

#### Database Records
```python
# REQUIRED: Cleanup in teardown
def tearDown(self):
    TestUser.objects.all().delete()
    TestProject.objects.all().delete()
    # Delete ALL test records
```

#### File-Based Test Data
```python
# REQUIRED: Cleanup test files
import os
import tempfile

def tearDown(self):
    if os.path.exists(self.test_file_path):
        os.remove(self.test_file_path)
    if os.path.exists(self.test_dir):
        shutil.rmtree(self.test_dir)
```

#### Mock Data Files
- Delete JSON fixtures after test
- Delete CSV test data after test
- Delete uploaded test images after test

### Prohibited Behaviors
- ❌ Leaving test records in development database
- ❌ Leaving fixture files on disk "for next test"
- ❌ Leaving temporary data "for debugging"
- ❌ Assuming test framework cleans up automatically

**RULE**: Explicit cleanup required, not assumed

---

## 3. VERIFICATION STEP (MANDATORY PRE-COMPLETION)

### Required Verification Sequence
Before marking work complete, agent **MUST** execute and report:

#### Step 1: File System Check
```bash
# List untracked files
git ls-files --others --exclude-standard

# Expected: Empty or only intentional new files
```

#### Step 2: Database Check (if applicable)
```bash
# Count test records in database
python manage.py shell -c "
from myapp.models import TestModel
print(TestModel.objects.filter(is_test=True).count())
"
# Expected: 0
```

#### Step 3: Temp Directory Check
```bash
# List temp files
ls -la /tmp/ | grep <project_name>
# Expected: Empty
```

#### Step 4: Process Check
```bash
# Check for lingering processes
ps aux | grep <project_name>
# Expected: No background processes
```

### Reporting Template
```markdown
## Cleanup Verification

✅ File system: No untracked temp files
✅ Database: 0 test records remaining
✅ Temp directory: Clean
✅ Processes: No lingering processes

Evidence:
- `git status --porcelain`: [output]
- Database test record count: 0
- Temp directory listing: [empty]
```

**VIOLATION**: Completion without cleanup verification report

---

## 4. ENVIRONMENT CONSISTENCY (STATE RESET)

### Virtual Environment State
After all work:
- Virtual environment may remain active
- No packages installed outside venv
- No global Python package pollution

### Verification
```bash
# Verify no packages in system Python
pip list --user
# Expected: Empty or only pre-existing packages
```

---

## 5. GIT REPOSITORY STATE (CLEAN WORKING TREE)

### Required Final State
```bash
git status
# Expected output:
# On branch <branch>
# Changes to be committed:
#   (only intentional changes)
# 
# Untracked files:
#   (only intentional new files)
```

### Prohibited Final State
- ❌ Modified files not staged for commit
- ❌ Untracked files not intended for commit
- ❌ Temporary files in working directory
- ❌ Build artifacts in working directory

---

## 6. LOG AND OUTPUT CLEANUP

### Console Output Files
- ❌ `output.txt`
- ❌ `debug.log`
- ❌ `test_results.log`
- ❌ Any captured stdout/stderr files

### Cleanup Requirement
Delete immediately after use or before completion

---

## 7. FAILURE RECOVERY (CLEANUP AFTER ERRORS)

### Error Cleanup Rule
If work fails partway through:
1. Delete any created test data
2. Delete any created temp files
3. Revert any database changes
4. Report failure AND cleanup status

**PROHIBITED**: Leaving mess after failed work

---

## 8. VERIFICATION CHECKLIST

Before marking work complete:
- [ ] All temp files deleted
- [ ] All log files deleted
- [ ] All test data deleted from database
- [ ] All mock fixtures deleted
- [ ] Git working tree clean (only intentional changes)
- [ ] No lingering processes
- [ ] Virtual environment state clean
- [ ] Cleanup verification report provided

**Incomplete checklist = INCOMPLETE WORK**