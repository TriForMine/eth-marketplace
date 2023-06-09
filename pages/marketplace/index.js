import {CourseCard, CourseList} from "components/ui/course";
import {BaseLayout} from "components/ui/layout";
import {getAllCourse} from "@content/courses/fetcher";
import {useOwnedCourses, useWalletInfo} from "@components/hooks/web3";
import {Button, Loader, Message} from "@components/ui/common";
import {OrderModal} from "@components/ui/order";
import {useState} from "react";
import {MarketHeader} from "@components/ui/marketplace";
import {useWeb3} from "@components/providers";
import {toast} from "react-toastify";
import {withToast} from "@utils/toast";

export default function Home({courses}) {
    const { web3, contract, requireInstall } = useWeb3()
    const { hasConnectedWallet, isConnecting, account } = useWalletInfo()
    const { ownedCourses } = useOwnedCourses(courses, account.data)

    const [ selectedCourse, setSelectedCourse ] = useState(null)
    const [ busyCourseId, setBusyCourseId ] = useState(null)
    const [ isNewPurchase, setIsNewPurchase ] = useState(true)

    const purchaseCourse = async (order, course) => {
        const hexCourseId = web3.utils.utf8ToHex(course.id)

        const orderHash = web3.utils.soliditySha3(
            { t: 'bytes16', value: hexCourseId },
            { t : "address", value: account.data }
        )

        const value = web3.utils.toWei(String(order.price), 'ether')

        setBusyCourseId(course.id)
        if (isNewPurchase) {
            const emailHash = web3.utils.sha3(order.email)

            const proof = web3.utils.soliditySha3(
                { t: 'bytes32', value: emailHash },
                { t: 'bytes32', value: orderHash }
            )

            withToast(_purchaseCourse({hexCourseId, proof, value}, course))
        } else {
            withToast(_repurchaseCourse({courseHash: orderHash, value}, course))
        }
    }

    const _purchaseCourse = async ({hexCourseId, proof, value}, course) => {
        try {
            const result = await contract.methods.purchaseCourse(
                hexCourseId,
                proof
            ).send({
                from: account.data,
                value
            })

            ownedCourses.mutate([
                ...ownedCourses.data,
                {
                    ...course,
                    proof,
                    state: "purchased",
                    owner: account.data,
                    price: value
                }
            ])

            return result
        } catch (e) {
            throw new Error(e.message)
        } finally {
            setBusyCourseId(null)
        }
    }

    const _repurchaseCourse = async ({courseHash, value}, course) => {
        try {
            const result = await contract.methods.repurchaseCourse(
                courseHash
            ).send({
                from: account.data,
                value
            })

            const index = ownedCourses.data.findIndex((ownedCourse) => ownedCourse.id === course.id)

            if (index >= 0) {
                ownedCourses.data[index].state = "purchased"
                ownedCourses.mutate(ownedCourses.data)
            } else {
                ownedCourses.mutate()
            }

            return result
        } catch (e) {
            throw new Error(e.message)
        } finally {
            setBusyCourseId(null)
        }
    }

    const cleanupModal = () => {
        setSelectedCourse(null)
        setIsNewPurchase(true)
    }

    return (
        <>
            <MarketHeader />
            <CourseList
                courses={courses}
            >
                {
                    (course) => {
                        const owned = ownedCourses.lookup[course.id]

                        return (
                            <CourseCard
                                key={course.id}
                                course={course}
                                state={owned?.state}
                                disabled={!hasConnectedWallet}
                                Footer={() => {
                                    if (requireInstall) {
                                        return (
                                            <Button
                                                size="sm"
                                                variant="lightPurple"
                                                disabled
                                            >
                                                Install
                                            </Button>
                                        )
                                    }

                                    if (isConnecting) {
                                        return (
                                            <Button
                                                size="sm"
                                                variant="lightPurple"
                                                disabled
                                            >
                                                <Loader size="sm"/>
                                            </Button>
                                        )
                                    }

                                    if (!ownedCourses.hasInitialResponse) {
                                        return (
                                            <Button
                                                variant="lightPurple"
                                                disabled
                                                size="sm"
                                            >
                                                { hasConnectedWallet ?
                                                    "Loading State..." :
                                                    "Connect"
                                                }
                                            </Button>
                                        )
                                    }

                                    const isBusy = busyCourseId === course.id

                                    if (owned) {
                                        return (
                                            <>
                                                <div className="flex">
                                                    <Button
                                                        onClick={() => alert("You are owner of this course")}
                                                        size="sm"
                                                        variant="white"
                                                        disabled={false}
                                                    >
                                                        Yours &#10004;
                                                    </Button>
                                                    {
                                                        owned.state === "deactivated" &&
                                                        <div className="ml-2">
                                                            <Button
                                                                size="sm"
                                                                variant="purple"
                                                                onClick={() => {
                                                                    setIsNewPurchase(false)
                                                                    setSelectedCourse(course)
                                                                }}
                                                                disabled={isBusy}
                                                            >
                                                                {
                                                                    isBusy ?
                                                                        <div className="flex">
                                                                            <Loader size="sm"/>
                                                                            <div className="ml-2">In Progress</div>
                                                                        </div>
                                                                        : <div>Fund to Reactivate</div>

                                                                }
                                                            </Button>
                                                        </div>
                                                    }
                                                </div>
                                            </>
                                        )
                                    }

                                    return <Button
                                        size="sm"
                                        onClick={() => {
                                            setIsNewPurchase(true)
                                            setSelectedCourse(course)
                                        }}
                                        variant="lightPurple"
                                        disabled={!hasConnectedWallet || isBusy}
                                    >
                                        {
                                            isBusy ?
                                                <div className="flex">
                                                    <Loader size="sm"/>
                                                    <div className="ml-2">In Progress</div>
                                                </div>
                                                : <div>Purchase</div>

                                        }
                                    </Button>
                                }}
                            />
                        )
                    }
                }
            </CourseList>
            {
                selectedCourse &&
                <OrderModal
                    course={selectedCourse}
                    isNewPurchase={isNewPurchase}
                    onSubmit={(formData, course) => {
                        purchaseCourse(formData, course)
                        cleanupModal()
                    }}
                    onClose={cleanupModal}
                />
            }
        </>
    )
}

export const getStaticProps = () => {
    const {data} = getAllCourse()

    return {
        props: {
            courses: data
        }
    }
}

Home.Layout = BaseLayout
