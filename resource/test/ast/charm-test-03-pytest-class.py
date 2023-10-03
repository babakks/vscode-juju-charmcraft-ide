#!/usr/bin/env python3

# (Read test case notes at the end.)

class TestClass:
    def test_something(self, test):
        pass
    
    async def test_something_async(self, test):
        pass

    def not_a_test_method(self):
        pass

class TestClassInvalid:
    # Since this class has a constructor, Pytest wouldn't recognize it as a test class.
    def __init__(self):
        pass

    def test_which_should_not_be_discovered(self, test):
        pass

# Invalid test class because of the missing 'Test' prefix in the name.
class InvalidTestClass:
    def test_which_should_not_be_discovered(self, test):
        pass

# Notes:
# - Both sync and async functions.
# - Pytest only recognizes constructor-less classes, so `TestClassInvalid` wouldn't be recognized.
# - Pytest only recognizes classes with 'Test' prefix in their names, so `InvalidTestClass` wouldn't be recognized.
# - See Pytest discovery conventions at:
#     https://docs.pytest.org/en/7.4.x/explanation/goodpractices.html#conventions-for-python-test-discovery
