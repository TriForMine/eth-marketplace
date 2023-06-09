import {MarketHeader} from "@components/ui/marketplace";
import {BaseLayout} from "@components/ui/layout";
import {CourseFilter, ManagedCourseCard, OwnedCourseCard} from "@components/ui/course";
import {Button, Message} from "@components/ui/common";
import {useAccount, useAdmin, useManagedCourses} from "@components/hooks/web3";
import {useEffect, useState} from "react";
import {useWeb3} from "@components/providers";
import {normalizeOwnedCourse} from "@utils/normalize";
import {withToast} from "@utils/toast";

const VerificationInput = ({onVerify}) => {
    const [ email, setEmail ] = useState("")

    return (
        <div className="flex mr-2 relative rounded-md">
            <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                name="email"
                id="email"
                className="w-96 focus:ring-indigo-500 shadow-md focus:border-indigo-500 block pl-7 p-4 sm:text-sm border-gray-300 rounded-md"
                placeholder="0x2341ab..." />
            <Button onClick={() => {
                onVerify(email)
            }}>
                Verify
            </Button>
        </div>
    )
}

export default function ManagedCourses() {
    const [ proofedOwnership, setProofedOwnership ] = useState({})
    const [ searchedCourse, setSearchedCourse ] = useState(null)
    const [ filters, setFilters] = useState({state: "all"})
    const { web3, contract } = useWeb3()
    const { account } = useAdmin({
        redirectTo: '/marketplace'
    })
    const { managedCourses } = useManagedCourses(account)

    const verifyCourse = (email, { hash, proof }) => {
        if (!email)
            return;

        const emailHash = web3.utils.sha3(email)
        const proofToCheck = web3.utils.soliditySha3({
            t: 'bytes32',
            v: emailHash
        }, {
            t: 'bytes32',
            v: hash
        })

        setProofedOwnership({
            ...proofedOwnership,
            [hash]: proofToCheck === proof
        })
    }

    const changeCourseState = async (courseHash, method) => {
        try {
            const result = await contract.methods
                [method](courseHash)
                .send({ from: account.data })

            return result
        } catch (e) {
            throw new Error(e.message)
        }
    }

    const activateCourse = async courseHash => {
        withToast(changeCourseState(courseHash, "activateCourse"))
    }

    const deactivateCourse = async courseHash => {
        withToast(changeCourseState(courseHash, "deactivateCourse"))
    }

    const searchCourse = async hash => {
        const re = /^0x[a-fA-F0-9]{64}$/g

        if (hash && hash.length === 66 && re.test(hash)) {
            const course = await contract.methods.getCourseByHash(hash).call()

            if (course.owner !== "0x0000000000000000000000000000000000000000") {
                const normalized = normalizeOwnedCourse(web3)({ hash }, course)
                setSearchedCourse(normalized)
                return;
            }
        }

        setSearchedCourse(null)
    }

    if (!account.isAdmin) {
        return null
    }

    const renderCard = (course, isSearched) => {
        return (
            <ManagedCourseCard key={course.ownedCourseId} isSearched={isSearched} course={course}>
                <VerificationInput onVerify={(email) => {
                    verifyCourse(email, {
                        hash: course.hash,
                        proof: course.proof
                    })
                }} />
                {
                    proofedOwnership[course.hash] && (
                        <div className='mt-2'>
                            <Message>
                                Verified!
                            </Message>
                        </div>
                    )
                }

                {
                    proofedOwnership[course.hash] === false && (
                        <div className='mt-2'>
                            <Message type="danger">
                                Wrong Proof!
                            </Message>
                        </div>
                    )
                }

                {
                    course.state === "purchased" && <div className="mt-2">
                        <Button onClick={() => activateCourse(course.hash)} variant="green">
                            Activate
                        </Button>
                        <Button onClick={() => deactivateCourse(course.hash)} variant="red">
                            Deactivate
                        </Button>
                    </div>
                }
            </ManagedCourseCard>
        )
    }

    const filteredCourses = managedCourses.data
        ?.filter(course => {
            return filters.state === "all" || course.state === filters.state
        })
        .map(course => renderCard(course))

    return (
        <>
            <MarketHeader />
            <CourseFilter
                onSearchSubmit={searchCourse}
                onFilterSelect={value => setFilters({ state: value })}
            />
            <section className="grid grid-cols-1">
                {
                    searchedCourse &&
                    <div>
                        <h1 className="text-2xl font-bold p-5">Search</h1>
                        { renderCard(searchedCourse, true) }
                    </div>
                }
                <h1 className="text-2xl font-bold p-5">All Courses</h1>
                {
                    filteredCourses
                }
                {
                    filteredCourses?.length === 0 && (
                        <Message type="warning">
                            No courses found
                        </Message>
                    )
                }
            </section>
        </>
    )
}

ManagedCourses.Layout = BaseLayout;
