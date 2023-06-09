const {catchRevert} = require("./utils/exceptions");
const CourseMarketplace = artifacts.require("CourseMarketplace")

const getBalance = async address => web3.eth.getBalance(address)
const toBN = value => web3.utils.toBN(value)

const getGas = async result => {
    const tx = await web3.eth.getTransaction(result.tx)
    const gasUsed = toBN(result.receipt.gasUsed)
    const gasPrice = toBN(tx.gasPrice)
    return gasUsed.mul(gasPrice)
}

contract("CourseMarketplace", accounts => {
    const courseId = "0x00000000000000000000000000003130";
    const proof = "0x0000000000000000000000000000313000000000000000000000000000003130";

    const courseId2 = "0x00000000000000000000000000002130";
    const proof2 = "0x0000000000000000000000000000213000000000000000000000000000002130";

    const value = "900000000";

    let _contract = null;
    let contractOwner = null;
    let buyer = null;
    let courseHash = null;

    before(async () => {
        _contract = await CourseMarketplace.deployed()
        contractOwner = accounts[0]
        buyer = accounts[1]
    })

    describe("Purchase the new course", () => {
        before(async () => {
            await _contract.purchaseCourse(courseId, proof, {
                from: buyer,
                value
            })
        })

        it("should NOT be able to purchase the same course", async () => {
            await catchRevert(_contract.purchaseCourse(courseId, proof, {
                from: buyer,
                value
            }))
        })

        it("can get the purchased course hash by index", async () => {
            const index = 0
            courseHash = await _contract.getCourseHashAtIndex(index)

            const expectedHash = web3.utils.soliditySha3(
                { type: "bytes16", value: courseId },
                { type: "address", value: buyer }
            )

            assert.equal(courseHash, expectedHash, "Course hash is not correct")
        })

        it("should match the data of the course purchased by buyer", async () => {
            const expectedIndex = 0
            const expectedState = 0
            const course = await _contract.getCourseByHash(courseHash)

            assert.equal(course.id, expectedIndex, "Course index should be 0!")
            assert.equal(course.price, value, `Course price should be ${value}!`)
            assert.equal(course.proof, proof, `Course proof should be ${proof}!`)
            assert.equal(course.owner, buyer, `Course owner should be ${buyer}!`)
            assert.equal(course.state, expectedState, `Course state should be ${expectedState}!`)
        })
    })

    describe("Activate the purchased course", () => {
        it("should NOT be able to activate the course by non-owner", async () => {
            await catchRevert(_contract.activateCourse(courseHash, { from: buyer }))
        })

        it("should have 'activated' status", async () => {
            await _contract.activateCourse(courseHash, { from: contractOwner })
            const course = await _contract.getCourseByHash(courseHash)
            const expectedState = 1

            assert.equal(course.state, expectedState, `Course state should be 'activated' state!`)
        })
    })

    describe("Transfer ownership", () => {
        let currentOwner = null

        before(async () => {
            currentOwner = await _contract.getContractOwner()
        })

        it("getContractOwner should return deployed address", async () => {
            assert.equal(currentOwner, contractOwner, "Contract owner should be the deployed address!")
        })

        it("should NOT be able to transfer ownership by non-owner", async () => {
            await catchRevert(_contract.transferOwnership(accounts[3], { from: accounts[4] }))
        })

        it("should be able to transfer ownership by owner", async () => {
            await _contract.transferOwnership(accounts[2], { from: contractOwner })
            currentOwner = await _contract.getContractOwner()

            assert.equal(currentOwner, accounts[2], "Contract owner should be the new owner!")
        })

        it("should transfer ownership back to the original owner", async () => {
            await _contract.transferOwnership(contractOwner, { from: accounts[2] })
            currentOwner = await _contract.getContractOwner()

            assert.equal(currentOwner, contractOwner, "Contract owner should be the original owner!")
        })
    })

    describe("Deactivate course", async () => {
        let courseHash2 = null
        let currentOwner = null

        before(async () => {
            await _contract.purchaseCourse(courseId2, proof2, {
                from: buyer,
                value
            })
            courseHash2 = await _contract.getCourseHashAtIndex(1)
            currentOwner = await _contract.getContractOwner()
        })

        it("Should NOT be able to deactivate course by non-owner", async () => {
            await catchRevert(_contract.deactivateCourse(courseHash2, { from: buyer }))
        })

        it("Should have status of 'deactivated' and price of 0", async () => {
            const beforeTxBuyerBalance = await getBalance(buyer)
            const beforeTxContractBalance = await getBalance(_contract.address)
            const beforeTxOwnerBalance = await getBalance(currentOwner)

            const result = await _contract.deactivateCourse(courseHash2, { from: contractOwner })

            const afterTxBuyerBalance = await getBalance(buyer)
            const afterTxContractBalance = await getBalance(_contract.address)
            const afterTxOwnerBalance = await getBalance(currentOwner)

            const course = await _contract.getCourseByHash(courseHash2)
            const expectedState = 2
            const expectedPrice = 0
            const gas = await getGas(result)

            assert.equal(course.state, expectedState, `Course state should be 'deactivated' state!`)
            assert.equal(course.price, expectedPrice, `Course price should be ${expectedPrice}!`)

            assert.equal(
                afterTxBuyerBalance.toString(),
                toBN(beforeTxBuyerBalance).add(toBN(value)).toString(),
                "Buyer balance should be increased by the course price!"
            )

            assert.equal(
                afterTxOwnerBalance.toString(),
                toBN(beforeTxOwnerBalance).sub(toBN(gas)).toString(),
                "Owner balance should be decreased by the gas fee!"
            )

            assert.equal(
                afterTxContractBalance.toString(),
                toBN(beforeTxContractBalance).sub(toBN(value)).toString(),
                "Contract balance should be decreased by the course price!"
            )
        })

        it("Should not be able to activate deactivated course", async () => {
            await catchRevert(_contract.activateCourse(courseHash2, { from: contractOwner }))
        })
    })

    describe("Repurchase course", () => {
        let courseHash2 = null

        before(async () => {
            courseHash2 = await _contract.getCourseHashAtIndex(1)
        })

        it("Should not repurchase when the course does not exist", async () => {
            let notExistingHash = "0x5ceb3f8075c3dbb5d490c8d1e6c950302ed065e1a9031750ad2c6513069e3fc3"
            await catchRevert(_contract.repurchaseCourse(notExistingHash, {
                from: buyer,
                value
            }))
        })

        it("Should not repurchase if not course owner", async () => {
            let notOwnerAddress = accounts[2]
            await catchRevert(_contract.repurchaseCourse(courseHash2, {
                from: notOwnerAddress,
                value
            }))
        })

        it("Should be able to repurchase course", async () => {
            const beforeTxBuyerBalance = await getBalance(buyer)
            const beforeTxContractBalance = await getBalance(_contract.address)
            const result = await _contract.repurchaseCourse(courseHash2, {
                from: buyer,
                value
            })
            const afterTxBuyerBalance = await getBalance(buyer)
            const afterTxContractBalance = await getBalance(_contract.address)


            const course = await _contract.getCourseByHash(courseHash2)
            const expectedState = 0
            const gas = await getGas(result)

            assert.equal(course.state, expectedState, `Course state should be ${expectedState}!`)
            assert.equal(course.price, value, `Course price should be ${value}!`)

            assert.equal(
                afterTxBuyerBalance,
                toBN(beforeTxBuyerBalance)
                    .sub(toBN(value))
                    .sub(gas)
                    .toString(),
                "Buyer balance should be decreased by the course price!"
            )

            assert.equal(
                afterTxContractBalance,
                toBN(beforeTxContractBalance)
                    .add(toBN(value))
                    .toString(),
                "Contract balance should be increased by the course price!"
            )
        })

        it("Should not be able to repurchase purchased course", async () => {
            await catchRevert(_contract.repurchaseCourse(courseHash2, {
                from: buyer,
                value
            }))
        })
    })

    describe("Receive funds", () => {
        it("should have transacted funds", async () => {
            const value = "1000000000000000000"
            const contractBeforeTx = await getBalance(_contract.address)

            await web3.eth.sendTransaction({
                from: accounts[0],
                to: _contract.address,
                value
            })

            const contractAfterTx = await getBalance(_contract.address)

            assert.equal(
                contractAfterTx,
                toBN(contractBeforeTx).add(toBN(value)).toString(),
                "Contract balance should be increased by the transaction value!"
            )
        })
    })

    describe("Normal withdraw", () => {
        const fundsToDeposit = "1000000000000000000"
        const overLimitFundsToDeposit = "10000000000000000000000"
        let currentOwner = null

        before(async () => {
            currentOwner = await _contract.getContractOwner()
            await web3.eth.sendTransaction({
                from: accounts[0],
                to: _contract.address,
                value: fundsToDeposit
            })
        })

        it("should not withdraw if not owner", async () => {
            const value = "1000000000000000000"
            await catchRevert(_contract.withdraw(value, { from: accounts[1] }))
        })

        it("should not withdraw if over limit", async () => {
            await catchRevert(_contract.withdraw(overLimitFundsToDeposit, { from: currentOwner }))
        })

        it("should have +0.1 ETH after withdraw", async () => {
            const value = "100000000000000000"
            const beforeTxOwnerBalance = await getBalance(currentOwner)
            const beforeTxContractBalance = await getBalance(_contract.address)
            const result = await _contract.withdraw(value, { from: currentOwner })
            const afterTxOwnerBalance = await getBalance(currentOwner)
            const afterTxContractBalance = await getBalance(_contract.address)
            const gas = await getGas(result)

            assert.equal(
                afterTxOwnerBalance,
                toBN(beforeTxOwnerBalance)
                    .add(toBN(value))
                    .sub(toBN(gas))
                    .toString(),
                "Owner balance should be increased by the transaction value!"
            )

            assert.equal(
                afterTxContractBalance,
                toBN(beforeTxContractBalance)
                    .sub(toBN(value))
                    .toString(),
                "Contract balance should be decreased by the transaction value!"
            )
        })
    })

    describe("Emergency withdraw", () => {
        let currentOwner = null

        before(async () => {
            currentOwner = await _contract.getContractOwner()
        })

        after(async () => {
            await _contract.resumeContract({ from: currentOwner })
        })

        it("should fail when contract is NOT stopped", async () => {
            await catchRevert(_contract.emergencyWithdraw({ from: currentOwner }))
        })

        it("should have +contract balance after emergency withdraw", async () => {
            await _contract.stopContract({ from: currentOwner })

            const beforeTxOwnerBalance = await getBalance(currentOwner)
            const beforeTxContractBalance = await getBalance(_contract.address)
            const result = await _contract.emergencyWithdraw({ from: currentOwner })
            const afterTxOwnerBalance = await getBalance(currentOwner)
            const afterTxContractBalance = await getBalance(_contract.address)
            const gas = await getGas(result)

            assert.equal(
                afterTxOwnerBalance,
                toBN(beforeTxOwnerBalance)
                    .add(toBN(beforeTxContractBalance))
                    .sub(toBN(gas))
                    .toString(),
                "Owner balance should be increased by the contract balance!"
            )

            assert.equal(
                afterTxContractBalance,
                0,
                "Contract balance should be 0!"
            )
        })

        it("should have contract balance 0 after emergency withdraw", async () => {
            const contractBalance = await getBalance(_contract.address)
            assert.equal(
                contractBalance,
                0,
                "Contract balance should be 0!"
            )
        })
    })

    describe("Self destruct", () => {
      let currentOwner = null

        before(async () => {
            currentOwner = await _contract.getContractOwner()
        })

        it("should fail when contract is NOT stopped", async () => {
            await catchRevert(_contract.selfDestruct({ from: currentOwner }))
        })

        it("should self destruct when contract is stopped", async () => {
            await _contract.stopContract({ from: currentOwner })
            await _contract.selfDestruct({ from: currentOwner })
            const contractBalance = await getBalance(_contract.address)
            assert.equal(
                contractBalance,
                0,
                "Contract balance should be 0!"
            )
        })

        it("should have 0x bytecode", async () => {
            const bytecode = await web3.eth.getCode(_contract.address)
            assert.equal(
                bytecode,
                "0x",
                "Contract bytecode should be 0x!"
            )
        })
    })
})
