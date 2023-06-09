export const createCourseHash = (web3) => (courseId, account) => {
    const hexCourseId = web3.utils.utf8ToHex(courseId)
    const courseHash = web3.utils.soliditySha3(
        { t: "bytes16", v: hexCourseId },
        { t: "address", v: account }
    )
    return courseHash
}
