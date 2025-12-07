# Tutorial 5: Security Best Practices

> **Learn to identify vulnerabilities and secure your smart contracts**

## Overview

In this tutorial, you'll learn:
- Common smart contract vulnerabilities
- How to identify security issues
- Best practices for secure development
- Using security analysis tools

## The Stakes Are High

Smart contract bugs can be catastrophic:
- **The DAO Hack (2016)**: $60M stolen via reentrancy
- **Parity Wallet (2017)**: $280M locked forever
- **Poly Network (2021)**: $600M stolen (returned)

## Common Vulnerabilities

### 1. Reentrancy

**The Problem:**
When a contract calls an external contract before updating its state, the external contract can call back and exploit the stale state.

**Vulnerable Code:**
```solidity
// ❌ VULNERABLE
function withdraw(uint256 amount) public {
    require(balances[msg.sender] >= amount);
    
    // External call BEFORE state update
    (bool success, ) = msg.sender.call{value: amount}("");
    require(success);
    
    // State update AFTER external call
    balances[msg.sender] -= amount;  // Too late!
}
```

**Attack:**
```solidity
contract Attacker {
    VulnerableContract target;
    
    function attack() public payable {
        target.deposit{value: 1 ether}();
        target.withdraw(1 ether);
    }
    
    receive() external payable {
        // Re-enter before balance is updated
        if (address(target).balance >= 1 ether) {
            target.withdraw(1 ether);
        }
    }
}
```

**Fixed Code:**
```solidity
// ✅ SECURE - Using Checks-Effects-Interactions pattern
function withdraw(uint256 amount) public nonReentrant {
    require(balances[msg.sender] >= amount, "Insufficient balance");
    
    // State update BEFORE external call
    balances[msg.sender] -= amount;
    
    // External call AFTER state update
    (bool success, ) = msg.sender.call{value: amount}("");
    require(success, "Transfer failed");
}
```

**TRCS Implementation:**
Check `contracts/Token.sol` - it uses OpenZeppelin's `ReentrancyGuard`:

```solidity
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract Token is ERC20, ReentrancyGuard {
    function transfer(address to, uint256 amount) 
        public 
        override 
        nonReentrant 
        returns (bool) 
    {
        return super.transfer(to, amount);
    }
}
```

### 2. Access Control Flaws

**The Problem:**
Functions that should be restricted are publicly accessible.

**Vulnerable Code:**
```solidity
// ❌ VULNERABLE - Anyone can mint!
function mint(address to, uint256 amount) public {
    _mint(to, amount);
}
```

**Fixed Code:**
```solidity
// ✅ SECURE - Only authorized minters
function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
    _mint(to, amount);
}
```

**TRCS Implementation:**
```solidity
bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

function mint(address to, uint256 amount) 
    public 
    onlyRole(MINTER_ROLE) 
{
    _mint(to, amount);
    emit TokensMinted(to, amount, msg.sender);
}
```

### 3. Integer Overflow/Underflow

**The Problem:**
In Solidity < 0.8, arithmetic operations could overflow silently.

**Vulnerable Code (Solidity < 0.8):**
```solidity
// ❌ VULNERABLE in Solidity < 0.8
uint8 public counter = 255;

function increment() public {
    counter += 1;  // Wraps to 0!
}
```

**Modern Solidity:**
```solidity
// ✅ SECURE - Solidity 0.8+ has built-in checks
pragma solidity ^0.8.0;

uint8 public counter = 255;

function increment() public {
    counter += 1;  // Reverts with overflow error
}
```

**Unchecked Blocks (use carefully):**
```solidity
function unsafeIncrement() public {
    unchecked {
        counter += 1;  // Wraps around (use only when intended)
    }
}
```

### 4. Front-Running

**The Problem:**
Miners/validators can see pending transactions and insert their own first.

**Vulnerable Pattern:**
```solidity
// ❌ VULNERABLE to front-running
function claimReward(bytes32 answer) public {
    require(keccak256(abi.encodePacked(answer)) == puzzle);
    payable(msg.sender).transfer(reward);
}
```

**Mitigation - Commit-Reveal:**
```solidity
// ✅ SECURE - Commit-reveal pattern
mapping(address => bytes32) public commits;
mapping(address => uint256) public commitBlock;

function commit(bytes32 hash) public {
    commits[msg.sender] = hash;
    commitBlock[msg.sender] = block.number;
}

function reveal(bytes32 answer, bytes32 salt) public {
    require(block.number > commitBlock[msg.sender] + 10, "Too early");
    require(
        keccak256(abi.encodePacked(answer, salt)) == commits[msg.sender],
        "Invalid reveal"
    );
    require(keccak256(abi.encodePacked(answer)) == puzzle);
    
    payable(msg.sender).transfer(reward);
}
```

### 5. Denial of Service (DoS)

**The Problem:**
Contracts can be made unusable by exploiting gas limits or unexpected reverts.

**Vulnerable Code:**
```solidity
// ❌ VULNERABLE - Array can grow unbounded
address[] public recipients;

function distribute() public {
    for (uint i = 0; i < recipients.length; i++) {
        // Will fail if array is too large
        payable(recipients[i]).transfer(1 ether);
    }
}
```

**Fixed Code:**
```solidity
// ✅ SECURE - Pull pattern instead of push
mapping(address => uint256) public pendingWithdrawals;

function allocate(address[] memory _recipients) public {
    for (uint i = 0; i < _recipients.length; i++) {
        pendingWithdrawals[_recipients[i]] += 1 ether;
    }
}

function withdraw() public {
    uint256 amount = pendingWithdrawals[msg.sender];
    pendingWithdrawals[msg.sender] = 0;
    payable(msg.sender).transfer(amount);
}
```

## Security Tools

### Slither - Static Analysis

```bash
# Install
pip install slither-analyzer

# Run on TRCS contracts
cd trcs
slither contracts/ --exclude-dependencies
```

**Sample Output:**
```
Token.mint(address,uint256) should emit an event for:
  - _mint(to,amount)
Reference: https://github.com/crytic/slither/wiki/...

Credential._beforeTokenTransfer(...) has external calls inside a loop
Reference: https://github.com/crytic/slither/wiki/...
```

### Mythril - Symbolic Execution

```bash
# Install
pip install mythril

# Analyze single contract
myth analyze contracts/Token.sol --solc-json mythril.config.json

# Quick analysis
myth analyze contracts/Token.sol -t 3
```

### Hardhat Test Coverage

```bash
# Run tests with coverage
npx hardhat coverage
```

**Target Coverage:**
- Smart Contracts: 95%+
- All branches covered
- Edge cases tested

## TRCS Security Audit Checklist

### Access Control

- [ ] All privileged functions have role checks
- [ ] DEFAULT_ADMIN_ROLE is properly protected
- [ ] Role hierarchy is correct
- [ ] Renouncing roles works correctly

### Token Security

- [ ] Minting is restricted to MINTER_ROLE
- [ ] Burning is restricted to BURNER_ROLE
- [ ] Pausing works correctly
- [ ] Permit (EIP-2612) is implemented securely

### Credential Security

- [ ] Only authorized issuers can mint
- [ ] Revocation is properly restricted
- [ ] Metadata URIs cannot be changed after minting
- [ ] Token transfers work correctly

### Reward Distribution

- [ ] Merkle proofs are validated correctly
- [ ] Double-claiming is prevented
- [ ] Campaign timing is enforced
- [ ] Withdrawal is properly restricted

## Exercise: Find the Bugs

Analyze this contract and identify at least 5 security issues:

```solidity
// VULNERABLE CONTRACT - DO NOT USE
pragma solidity ^0.8.0;

contract VulnerableVault {
    mapping(address => uint256) public balances;
    address[] public depositors;
    address public owner;
    bool public locked;
    
    constructor() {
        owner = msg.sender;
    }
    
    // Issue 1: ???
    function deposit() public payable {
        balances[msg.sender] += msg.value;
        depositors.push(msg.sender);
    }
    
    // Issue 2: ???
    function withdraw(uint256 amount) public {
        require(balances[msg.sender] >= amount);
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success);
        balances[msg.sender] -= amount;
    }
    
    // Issue 3: ???
    function setOwner(address newOwner) public {
        owner = newOwner;
    }
    
    // Issue 4: ???
    function distributeRewards() public {
        require(msg.sender == owner);
        uint256 reward = address(this).balance / depositors.length;
        for (uint i = 0; i < depositors.length; i++) {
            payable(depositors[i]).transfer(reward);
        }
    }
    
    // Issue 5: ???
    function lock() public {
        require(msg.sender == owner);
        locked = true;
    }
    
    function unlock() public {
        locked = false;
    }
}
```

<details>
<summary>Click to reveal answers</summary>

1. **deposit()**: Duplicate depositor entries - no check for existing deposits
2. **withdraw()**: Reentrancy vulnerability - state update after external call
3. **setOwner()**: Missing access control - anyone can change owner
4. **distributeRewards()**: DoS vulnerability - unbounded loop, division by zero
5. **unlock()**: Missing access control - anyone can unlock

</details>

## Best Practices Summary

### Development

1. **Use OpenZeppelin** - Battle-tested, audited contracts
2. **Follow CEI Pattern** - Checks, Effects, Interactions
3. **Use Modifiers** - Centralize access control
4. **Emit Events** - For all state changes
5. **Validate Inputs** - Never trust user input

### Testing

1. **100% Branch Coverage** - Test all paths
2. **Fuzz Testing** - Random inputs
3. **Edge Cases** - Zero values, max values, empty arrays
4. **Failure Scenarios** - Test reverts

### Deployment

1. **Multi-sig Admin** - No single point of failure
2. **Timelocks** - Delay for critical operations
3. **Pausability** - Emergency stop mechanism
4. **Upgradability** - Plan for fixes (carefully!)

### Operations

1. **Monitoring** - Watch for anomalies
2. **Incident Response** - Have a plan
3. **Bug Bounty** - Incentivize security research
4. **Regular Audits** - Annual minimum

## Additional Resources

- [Consensys Smart Contract Best Practices](https://consensys.github.io/smart-contract-best-practices/)
- [OpenZeppelin Security Docs](https://docs.openzeppelin.com/contracts/4.x/security)
- [SWC Registry](https://swcregistry.io/) - Smart Contract Weakness Classification
- [Damn Vulnerable DeFi](https://www.damnvulnerabledefi.xyz/) - CTF for learning

---

*Congratulations! You've completed the TRCS tutorial series! 🎉*
